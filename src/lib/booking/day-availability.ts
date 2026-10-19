import { and, gt, inArray, lt } from "drizzle-orm";

import db from "@/db";
import { reservation, roomBlock, type ServicePeriodKind } from "@/db/schema";
import type { BookingMode } from "@/lib/admin/room-types";
import { listHolidays, type HolidayRow } from "@/lib/admin/holidays";
import { listRooms } from "@/lib/admin/rooms";
import {
  listServicePeriods,
  resolveServicePeriodForDate,
  type ServicePeriodRow,
} from "@/lib/admin/service-periods";

import { isValidBookingDate, parseBookingDate, shiftBookingDate } from "./booking-date";
import { minutesToTime, SLOT_DURATION_MINUTES, timeToMinutes } from "./time";

// วันที่ (รูปแบบ/การเลื่อนวัน) เป็นตรรกะบริสุทธิ์ที่ย้ายไป booking-date แล้ว
// re-export ไว้เพื่อให้ผู้เรียกเดิม (reservations, หน้าจอ) ยัง import จากที่นี่ได้
export { parseBookingDate, shiftBookingDate };

/**
 * ตรรกะหน้าผู้ใช้เลือกวัน ห้อง และช่องว่าง (TOR ข้อ 5)
 * แยกเป็นฟังก์ชันบริสุทธิ์ที่ทดสอบได้ ไม่แตะฐานข้อมูล — การดึงข้อมูลจริงอยู่ที่
 * getDayAvailability() ในไฟล์เดียวกัน (ตามรูปแบบ src/lib/admin/*.ts)
 *
 * ทุกการคำนวณเวลาใช้เขตเวลา Asia/Bangkok — เวลาหน้าปัดของ slot เป็น 'HH:MM'
 * ของวันที่ 'YYYY-MM-DD' และถูกแปลงเป็น instant ด้วย offset +07:00 (คงที่ ไม่มี DST)
 */

const BANGKOK_UTC_OFFSET = "+07:00";

/** แปลงเวลาหน้าปัดของวันที่หนึ่งใน Asia/Bangkok เป็น instant (Date จริง) */
export function bangkokInstant(date: string, time: string): Date {
  return new Date(`${date}T${time.slice(0, 5)}:00${BANGKOK_UTC_OFFSET}`);
}

/** หนึ่งช่องว่าง 1 ชั่วโมง — เวลาหน้าปัดในวันที่เลือก */
export type SlotRange = {
  /** 'HH:MM' */
  start: string;
  /** 'HH:MM' */
  end: string;
};

/**
 * แตกช่องว่าง 1 ชั่วโมงเริ่มจากเวลาเปิดของวันนั้น (TOR ข้อ 5.3)
 * ตัวอย่าง (เปิด 08:30): 08:30–09:30, 09:30–10:30, …
 * ช่องที่จะเกินเวลาปิดจะไม่ถูกสร้าง — slot ต้องอยู่ครบในเวลาให้บริการ
 * รับเวลาคอลัมน์ time ของ PG ได้ทั้ง 'HH:MM' และ 'HH:MM:SS'
 */
export function buildDaySlots(openTime: string, closeTime: string): SlotRange[] {
  const open = timeToMinutes(openTime);
  const close = timeToMinutes(closeTime);

  if (open === null || close === null || close <= open) {
    return [];
  }

  const slots: SlotRange[] = [];

  for (let start = open; start + SLOT_DURATION_MINUTES <= close; start += SLOT_DURATION_MINUTES) {
    slots.push({ start: minutesToTime(start), end: minutesToTime(start + SLOT_DURATION_MINUTES) });
  }

  return slots;
}

/** ช่วงเวลาแบบ instant ที่มาจาก DB (คอลัมน์ timestamptz) */
export type TimeRange = {
  startTime: Date;
  endTime: Date;
};

/** สถานะของหนึ่งช่องว่างต่อหนึ่งห้อง */
export type RoomSlotStatus = "free" | "occupied" | "blocked";

/** ช่องว่างของห้องหนึ่งในวันที่เลือก พร้อมสถานะและความสามารถเลือก */
export type RoomSlotView = {
  /** 'HH:MM' */
  start: string;
  /** 'HH:MM' */
  end: string;
  status: RoomSlotStatus;
  /** จำนวนรายการจองที่ครองช่วงเวลานี้ (PENDING/ACTIVE) — ใช้แสดงผลของห้อง CAPACITY */
  usedCount: number;
  /** ช่องที่เริ่มแล้ว (เทียบกับเวลาปัจจุบันใน Bangkok) */
  past: boolean;
  /** เลือกจองได้จริงหรือไม่ */
  selectable: boolean;
};

/**
 * คำนวณสถานะของแต่ละช่องว่างของห้องหนึ่งในวันที่เลือก (TOR ข้อ 5.3, 6.2)
 * - blocked > occupied > free (แสดงผล) — ช่องที่ถูกบล็อกแสดง "ถูกบล็อก" แม้จะมีการจอง
 * - past = ช่องเริ่มแล้ว (รวมช่องที่กำลังอยู่ระหว่างเวลา) — เลือกไม่ได้เสมอ
 * - CAPACITY: จองทับได้จนเต็ม max_capacity (usedCount < maxCapacity ยังเลือกได้)
 * - EXCLUSIVE: มีการจองครองอยู่แล้วเลือกไม่ได้
 * - การซ้อนกันเป็นช่วงเปิดปิด [) — ชนกันตรงขอบไม่นับ
 */
export function computeRoomSlots(input: {
  date: string;
  slots: readonly SlotRange[];
  bookingMode: BookingMode;
  maxCapacity: number | null;
  /** รายการจองสถานะครองช่วงเวลา (PENDING/ACTIVE) ที่ทับวันนั้น */
  reservations: readonly TimeRange[];
  /** การบล็อกห้องที่ทับวันนั้น */
  blocks: readonly TimeRange[];
  now: Date;
}): RoomSlotView[] {
  const capacity = input.maxCapacity ?? 0;

  return input.slots.map((slot) => {
    const slotStart = bangkokInstant(input.date, slot.start);
    const slotEnd = bangkokInstant(input.date, slot.end);

    const overlaps = (range: TimeRange): boolean =>
      range.startTime < slotEnd && range.endTime > slotStart;

    const usedCount = input.reservations.filter(overlaps).length;
    const blocked = input.blocks.some(overlaps);
    const past = input.now >= slotStart;

    const status: RoomSlotStatus = blocked
      ? "blocked"
      : usedCount > 0
        ? "occupied"
        : "free";

    const hasRoomLeft =
      input.bookingMode === "CAPACITY" ? usedCount < capacity : usedCount === 0;

    return {
      start: slot.start,
      end: slot.end,
      status,
      usedCount,
      past,
      selectable: !past && !blocked && hasRoomLeft,
    };
  });
}

// ============================================
// การดึงข้อมูลจริง (DB) สำหรับหน้าผู้ใช้
// ============================================

/** สถานะที่ "ครองช่วงเวลา" นับเป็นผู้ใช้ห้อง (TOR ข้อ 6.2) */
export const OCCUPYING_STATUSES = ["PENDING", "ACTIVE"] as const;

/** แถวช่วงเวลาที่ทับวันนั้น พร้อมห้องที่เกี่ยวข้อง */
type RangedRoomRow = {
  roomId: string;
  startTime: Date;
  endTime: Date;
};

/** ห้องหนึ่งในวันที่เลือก พร้อมช่องว่างและสถานะของแต่ละช่อง */
export type RoomDayAvailability = {
  id: string;
  name: string;
  roomTypeCode: string;
  roomTypeName: string;
  bookingMode: BookingMode;
  maxCapacity: number | null;
  /** ระยะเวลาขั้นต่ำของประเภทห้อง (นาที) — UI เตือนก่อนยืนยัน (TOR ข้อ 4) */
  minDurationMinutes: number;
  slots: RoomSlotView[];
};

/** ผลของการดูความพร้อมของวันที่เลือก */
export type DayAvailability =
  | {
      date: string;
      open: false;
      reason: DayClosedReason;
      holidayName: string | null;
    }
  | {
      date: string;
      open: true;
      kind: ServicePeriodKind;
      openTime: string;
      closeTime: string;
      slots: SlotRange[];
      rooms: RoomDayAvailability[];
    };

/** รายการจองที่ครองช่วงเวลาซ้อนกับวันนั้น (กรองสถานะครองช่วงไว้ที่ query) */
async function listOccupyingReservations(
  dayStart: Date,
  dayEnd: Date,
): Promise<RangedRoomRow[]> {
  return db
    .select({
      roomId: reservation.roomId,
      startTime: reservation.startTime,
      endTime: reservation.endTime,
    })
    .from(reservation)
    .where(
      and(
        inArray(reservation.status, [...OCCUPYING_STATUSES]),
        lt(reservation.startTime, dayEnd),
        gt(reservation.endTime, dayStart),
      ),
    );
}

/** การบล็อกห้องที่ซ้อนกับวันนั้น */
async function listDayRoomBlocks(dayStart: Date, dayEnd: Date): Promise<RangedRoomRow[]> {
  return db
    .select({
      roomId: roomBlock.roomId,
      startTime: roomBlock.startTime,
      endTime: roomBlock.endTime,
    })
    .from(roomBlock)
    .where(and(lt(roomBlock.startTime, dayEnd), gt(roomBlock.endTime, dayStart)));
}

/** แบ่งรายการเป็นแผนที่รายห้อง เพื่อให้ computeRoomSlots ใช้เฉพาะช่วงของห้องตัวเอง */
function groupByRoom(rows: readonly RangedRoomRow[]): Map<string, TimeRange[]> {
  const grouped = new Map<string, TimeRange[]>();

  for (const row of rows) {
    const list = grouped.get(row.roomId);

    if (list) {
      list.push({ startTime: row.startTime, endTime: row.endTime });
    } else {
      grouped.set(row.roomId, [{ startTime: row.startTime, endTime: row.endTime }]);
    }
  }

  return grouped;
}

/**
 * ความพร้อมของวันที่เลือกสำหรับหน้าผู้ใช้ (TOR ข้อ 5)
 * - วันปิด (เสาร์–อาทิตย์/วันหยุด/ไม่มีช่วงเวลา) คืนผลปิดทันที
 *   โดยไม่แตะตารางห้อง/การจอง/บล็อก — หน้าจึงโหลดเร็วไม่ต้องรอข้อมูลส่วนอื่น
 * - ห้องที่แสดงเป็นห้องที่ยังไม่ถูก soft delete (listRooms กรองให้)
 * - การจองที่นับเป็นผู้ใช้ห้องมีเฉพาะสถานะครองช่วงเวลา PENDING/ACTIVE
 */
export async function getDayAvailability(
  date: string,
  now: Date = new Date(),
): Promise<DayAvailability> {
  const [servicePeriods, holidays] = await Promise.all([
    listServicePeriods(),
    listHolidays(),
  ]);

  const window = resolveDayServiceWindow(date, servicePeriods, holidays);

  if (!window.open) {
    return {
      date,
      open: false,
      reason: window.reason,
      holidayName: window.holidayName,
    };
  }

  const slots = buildDaySlots(window.openTime, window.closeTime);
  const dayStart = bangkokInstant(date, "00:00");
  const dayEnd = bangkokInstant(shiftBookingDate(date, 1), "00:00");

  const [rooms, reservations, blocks] = await Promise.all([
    listRooms(),
    listOccupyingReservations(dayStart, dayEnd),
    listDayRoomBlocks(dayStart, dayEnd),
  ]);

  const reservationsByRoom = groupByRoom(reservations);
  const blocksByRoom = groupByRoom(blocks);

  return {
    date,
    open: true,
    kind: window.kind,
    openTime: window.openTime,
    closeTime: window.closeTime,
    slots,
    rooms: rooms.map((room) => ({
      id: room.id,
      name: room.name,
      roomTypeCode: room.roomTypeCode,
      roomTypeName: room.roomTypeName,
      bookingMode: room.bookingMode,
      maxCapacity: room.maxCapacity,
      minDurationMinutes: room.minDurationMinutes,
      slots: computeRoomSlots({
        date,
        slots,
        bookingMode: room.bookingMode,
        maxCapacity: room.maxCapacity,
        reservations: reservationsByRoom.get(room.id) ?? [],
        blocks: blocksByRoom.get(room.id) ?? [],
        now,
      }),
    })),
  };
}

/** เหตุผลที่วันนั้นปิดรับจอง */
export type DayClosedReason = "weekend" | "holiday" | "no-service-period";

/** ผลของการเปิด–ปิดของวัน */
export type DayServiceWindow =
  | { open: false; reason: DayClosedReason; holidayName: string | null }
  | {
      open: true;
      kind: ServicePeriodKind;
      openTime: string;
      closeTime: string;
    };

/**
 * คำนวณเวลาเปิด–ปิดของวันที่กำหนด (TOR ข้อ 5.1–5.2)
 * - วันเสาร์–อาทิตย์ = ปิดทั้งระบบ (คำนวณจากวันที่ ไม่พึ่ง timezone ของ server)
 * - วันหยุดนักขัตฤกษ์ = ปิดทั้งระบบ พร้อมชื่อวันหยุดสำหรับแสดงผล
 * - นอกนั้นใช้ช่วง EXAM ที่มีผล (สร้างล่าสุดชนะ) ถ้าไม่มีใช้ NORMAL
 * - ไม่มีช่วงใดมีผลเลย = ปิด (ยังไม่มีเวลาให้บริการ)
 */
export function resolveDayServiceWindow(
  date: string,
  servicePeriods: readonly ServicePeriodRow[],
  holidays: readonly HolidayRow[],
): DayServiceWindow {
  if (isWeekend(date)) {
    return { open: false, reason: "weekend", holidayName: null };
  }

  const holiday = holidays.find((row) => row.holidayDate === date);

  if (holiday) {
    return { open: false, reason: "holiday", holidayName: holiday.name };
  }

  const period = resolveServicePeriodForDate(servicePeriods, date);

  if (!period) {
    return { open: false, reason: "no-service-period", holidayName: null };
  }

  return {
    open: true,
    kind: period.kind,
    openTime: period.openTime,
    closeTime: period.closeTime,
  };
}

/**
 * ตรวจวันเสาร์–อาทิตย์จากสตริง YYYY-MM-DD โดยตรง (UTC เที่ยงวัน ไม่มี edge เขตเวลา)
 * คืน false เมื่อรูปแบบวันที่ไม่ถูกต้อง
 */
function isWeekend(date: string): boolean {
  if (!isValidBookingDate(date)) {
    return false;
  }

  const day = new Date(`${date}T12:00:00Z`).getUTCDay();

  return day === 0 || day === 6;
}
