import { randomInt } from "node:crypto";

import { and, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";

import db from "@/db";
import {
  reservation,
  roomBlock,
  rooms,
  roomType,
  users,
  type Reservation,
} from "@/db/schema";
import { listHolidays } from "@/lib/admin/holidays";
import { pgErrorCode, pgErrorMessage } from "@/lib/admin/pg-error";
import { listServicePeriods } from "@/lib/admin/service-periods";
import type { BookingMode } from "@/lib/admin/room-types";
import {
  enqueueBookingCodeEmail,
  type EnqueueBookingCodeEmail,
} from "@/lib/notifications/outbox";

import {
  bangkokInstant,
  buildDaySlots,
  OCCUPYING_STATUSES,
  parseBookingDate,
  resolveDayServiceWindow,
} from "./day-availability";

/**
 * ชั้นข้อมูล/โดเมนของการจองห้องของผู้ใช้ (ไม่ใช่ "use server" — TOR ข้อ 6)
 * การจอง 1 บล็อก = ช่วงเวลาที่จับคู่กับ slot จริงของวันนั้นพอดี (บล็อกละ 1 ชั่วโมง)
 *
 * กติกาทุกข้อถูกตรวจ "ก่อน" บันทึก (TOR ข้อ 6.2):
 * วันทำการ/เวลาให้บริการ → ขอบเขต slot → ไม่ใช่ช่องที่ผ่านไปแล้ว → ห้องยังใช้งานอยู่ →
 * ระยะเวลาขั้นต่ำตามประเภทห้อง → ไม่ทับ room_block
 * ส่วนการจองซ้ำซ้อนปล่อยให้ DB เป็นด่านสุดท้าย:
 *   - ห้อง EXCLUSIVE: exclusion constraint `reservation_room_exclusive` (23P01)
 *   - ผู้ใช้คนเดียวห้ามทับตัวเอง: `reservation_user_no_overlap` (23P01)
 *   - ห้อง CAPACITY: advisory lock ต่อห้อง แล้วนับก่อน insert (สูตร A.5)
 */

/** คำขอจองห้อง 1 ช่วง — ช่วงเวลาต้องจับคู่กับ slot ของวันนั้นพอดี */
export type BookingRequest = {
  roomId: string;
  /** 'YYYY-MM-DD' */
  date: string;
  /** 'HH:MM' */
  startTime: string;
  /** 'HH:MM' */
  endTime: string;
};

/** ผลของการจอง — คืนรูปเดียวกันให้ UI แสดงข้อความ inline ได้ */
export type BookingResult =
  | { ok: true; bookingCode: string }
  | { ok: false; message: string };

/** ค่าที่ injecting ได้สำหรับเทสต์ (เวลาปัจจุบัน/ตัวสร้างรหัส/การเข้าคิวอีเมล) */
export type BookingDeps = {
  now?: Date;
  generateCode?: () => string;
  /** สร้างรายการคิวส่งรหัสทางอีเมล — ค่าเริ่มต้นเขียนลง notification_outbox จริง */
  enqueue?: (input: EnqueueBookingCodeEmail) => Promise<void>;
};

const DATE_MESSAGE = "วันที่เลือกไม่ถูกต้อง กรุณาเลือกวันที่ใหม่";
const WEEKEND_MESSAGE = "วันเสาร์–อาทิตย์ปิดทำการ ไม่สามารถจองได้";
const NO_SERVICE_PERIOD_MESSAGE = "ยังไม่มีช่วงเวลาให้บริการสำหรับวันที่เลือก";
const SLOT_OUTSIDE_MESSAGE =
  "ช่วงเวลาที่เลือกไม่อยู่ในเวลาให้บริการของวันนั้น กรุณาเลือกช่วงเวลาใหม่";
const PAST_MESSAGE = "ช่วงเวลาที่เลือกเริ่มไปแล้ว กรุณาเลือกช่วงเวลาใหม่";
const ROOM_NOT_FOUND_MESSAGE =
  "ไม่พบห้องที่เลือก ห้องอาจถูกยกเลิกไปแล้ว กรุณารีเฟรชหน้าแล้วลองใหม่";
const BLOCKED_MESSAGE = "ห้องนี้ถูกบล็อกในช่วงเวลาที่เลือก กรุณาเลือกห้องหรือช่วงเวลาอื่น";
const ROOM_TAKEN_MESSAGE = "ช่วงเวลานี้มีผู้ใช้จองห้องนี้แล้ว กรุณาเลือกช่วงเวลาอื่น";
const USER_OVERLAP_MESSAGE =
  "คุณมีการจองอื่นที่ทับซ้อนกับช่วงเวลานี้อยู่แล้ว กรุณาเลือกช่วงเวลาอื่น";
const CAPACITY_FULL_MESSAGE = "ห้องเต็มความจุในช่วงเวลานี้แล้ว กรุณาเลือกช่วงเวลาอื่น";
const CODE_UNAVAILABLE_MESSAGE = "ไม่สามารถสร้างรหัสการจองได้ กรุณาลองใหม่อีกครั้ง";

function holidayMessage(name: string | null): string {
  return name
    ? `เป็นวันหยุด ${name} ระบบปิดทำการ ไม่สามารถจองได้`
    : "วันหยุดนักขัตฤกษ์ ระบบปิดทำการ ไม่สามารถจองได้";
}

function minDurationMessage(minutes: number): string {
  return `ห้องนี้ต้องจองอย่างน้อย ${minutes} นาที กรุณาเลือกช่วงเวลาต่อเนื่องให้ครบ`;
}

/** ระยะเวลาของหนึ่งบล็อก (TOR ข้อ 5.3) */
const SLOT_DURATION_MINUTES = 60;

/** จำนวนครั้งสูงสุดที่สุ่มรหัสใหม่เมื่อชนกับการจองวันเดียวกัน (reservation_code_per_day) */
const MAX_CODE_ATTEMPTS = 5;

/** สุ่มรหัสการจองตัวเลข 6 หลัก (000000–999999) */
export function randomBookingCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** แถวห้องพร้อมกติกาประเภทห้องที่ต้องใช้ตัดสินใจตอนจอง */
type RoomRuleRow = {
  roomId: string;
  roomName: string;
  maxCapacity: number | null;
  bookingMode: BookingMode;
  minDurationMinutes: number;
};

const ROOM_RULE_COLUMNS = {
  roomId: rooms.id,
  roomName: rooms.name,
  maxCapacity: rooms.maxCapacity,
  bookingMode: roomType.bookingMode,
  minDurationMinutes: roomType.minDurationMinutes,
};

/**
 * จองห้องให้ผู้ใช้ 1 ช่วงเวลา — คืนรหัสการจอง 6 หลักเมื่อสำเร็จ (สถานะ PENDING)
 * booking_mode / booking_date เป็นค่าที่ trigger ที่ DB เซ็ตทับทุกครั้ง (A.12)
 * จึงส่งค่าคำนวณไปประกอบ type ให้ครบเท่านั้น
 */
export async function createReservation(
  request: BookingRequest,
  userId: string,
  deps: BookingDeps = {},
): Promise<BookingResult> {
  const now = deps.now ?? new Date();
  const generateCode = deps.generateCode ?? randomBookingCode;

  if (!parseBookingDate(request.date)) {
    return { ok: false, message: DATE_MESSAGE };
  }

  const [servicePeriods, holidays] = await Promise.all([
    listServicePeriods(),
    listHolidays(),
  ]);

  const window = resolveDayServiceWindow(request.date, servicePeriods, holidays);

  if (!window.open) {
    if (window.reason === "weekend") {
      return { ok: false, message: WEEKEND_MESSAGE };
    }

    if (window.reason === "holiday") {
      return { ok: false, message: holidayMessage(window.holidayName) };
    }

    return { ok: false, message: NO_SERVICE_PERIOD_MESSAGE };
  }

  // ช่วงเวลาที่ขอต้องจับคู่กับ slot จริงของวันนั้นพอดี — เริ่มที่ startTime จบลงที่ endTime
  // (กันการพิมพ์เวลาเอง และกันช่วงที่คร่อมเวลาปิดของวัน)
  const slots = buildDaySlots(window.openTime, window.closeTime);
  const startIndex = slots.findIndex((slot) => slot.start === request.startTime);
  const endIndex = slots.findIndex((slot) => slot.end === request.endTime);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return { ok: false, message: SLOT_OUTSIDE_MESSAGE };
  }

  const startTime = bangkokInstant(request.date, request.startTime);
  const endTime = bangkokInstant(request.date, request.endTime);

  if (now >= startTime) {
    return { ok: false, message: PAST_MESSAGE };
  }

  const roomRows: RoomRuleRow[] = await db
    .select(ROOM_RULE_COLUMNS)
    .from(rooms)
    .innerJoin(roomType, eq(rooms.roomTypeId, roomType.id))
    .where(and(eq(rooms.id, request.roomId), isNull(rooms.deletedAt)))
    .limit(1);

  const room = roomRows[0];

  if (!room) {
    return { ok: false, message: ROOM_NOT_FOUND_MESSAGE };
  }

  const durationMinutes = (endIndex - startIndex + 1) * SLOT_DURATION_MINUTES;

  if (durationMinutes < room.minDurationMinutes) {
    return { ok: false, message: minDurationMessage(room.minDurationMinutes) };
  }

  const blocks = await db
    .select({ id: roomBlock.id })
    .from(roomBlock)
    .where(
      and(
        eq(roomBlock.roomId, room.roomId),
        lt(roomBlock.startTime, endTime),
        gt(roomBlock.endTime, startTime),
      ),
    )
    .limit(1);

  if (blocks.length > 0) {
    return { ok: false, message: BLOCKED_MESSAGE };
  }

  const baseValues = {
    userId,
    roomId: room.roomId,
    bookingMode: room.bookingMode,
    bookingDate: request.date,
    startTime,
    endTime,
    status: "PENDING" as const,
  };

  // อีเมลผู้จองสำหรับคิวแจ้งเตือน (users.email NOT NULL — ถ้าไม่พบถือว่าผิดปกติและข้ามการเข้าคิว)
  const [booker] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const enqueue = deps.enqueue ?? enqueueBookingCodeEmail;

  /**
   * เข้าคิวส่งรหัสทางอีเมล "หนึ่งครั้งต่อการจองหนึ่งระเบียน" (TOR ข้อ 11, #14)
   * อีเมลเป็นส่วนเสริม: หน้ายืนยันแสดงรหัสบนจอเสมอ (#8) การเข้าคิวล้มเหลวจึงไม่ทำให้การจองล้มเหลว
   */
  async function enqueueBookingCode(row: {
    id: string;
    bookingCode: string;
  }): Promise<void> {
    if (!booker?.email) {
      return;
    }

    try {
      await enqueue({
        reservationId: row.id,
        toEmail: booker.email,
        bookingCode: row.bookingCode,
        roomName: room.roomName,
        bookingDate: request.date,
        startTime,
        endTime,
      });
    } catch (error) {
      console.error("เข้าคิวส่งรหัสการจองไม่สำเร็จ", error);
    }
  }

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const bookingCode = generateCode();

    try {
      if (room.bookingMode === "CAPACITY") {
        // ล็อกต่อห้องก่อนนับ แล้วจึง insert (สูตร A.5) — advisory xact lock ปล่อยเมื่อจบ transaction
        const outcome = await db.transaction(async (tx) => {
          await tx.execute(
            sql`SELECT pg_advisory_xact_lock(hashtextextended(${room.roomId}::text, 0))`,
          );

          const used = await tx
            .select({ id: reservation.id })
            .from(reservation)
            .where(
              and(
                eq(reservation.roomId, room.roomId),
                inArray(reservation.status, [...OCCUPYING_STATUSES]),
                lt(reservation.startTime, endTime),
                gt(reservation.endTime, startTime),
              ),
            );

          if (used.length >= (room.maxCapacity ?? 0)) {
            return { full: true as const };
          }

          const [row] = await tx
            .insert(reservation)
            .values({ ...baseValues, bookingCode })
            .returning({ id: reservation.id, bookingCode: reservation.bookingCode });

          return { full: false as const, row: row! };
        });

        if (outcome.full) {
          return { ok: false, message: CAPACITY_FULL_MESSAGE };
        }

        await enqueueBookingCode(outcome.row);
        return { ok: true, bookingCode: outcome.row.bookingCode };
      }

      // ห้อง EXCLUSIVE: ปล่อยให้ exclusion constraint `reservation_room_exclusive` กันการจองทับ
      const [row] = await db
        .insert(reservation)
        .values({ ...baseValues, bookingCode })
        .returning({ id: reservation.id, bookingCode: reservation.bookingCode });

      await enqueueBookingCode(row!);
      return { ok: true, bookingCode: row!.bookingCode };
    } catch (error) {
      // รหัสซ้ำกับการจองวันเดียวกัน (unique index reservation_code_per_day) — สุ่มใหม่
      if (pgErrorCode(error) === "23505") {
        continue;
      }

      const mapped = mapExclusionViolation(error);

      if (mapped) {
        return mapped;
      }

      throw error;
    }
  }

  return { ok: false, message: CODE_UNAVAILABLE_MESSAGE };
}

/** ข้อมูลหน้ายืนยันการจอง — แถวแคบที่หน้า confirmation ต้องแสดง */
export type BookingConfirmation = {
  bookingCode: string;
  status: Reservation["status"];
  roomName: string;
  roomTypeCode: string;
  /** 'YYYY-MM-DD' (booking_date ที่ trigger เซ็ต) */
  bookingDate: string;
  startTime: Date;
  endTime: Date;
};

/**
 * อ่านการจองตามรหัสสำหรับหน้ายืนยัน — จำกัดด้วย user id ของผู้เรียกเสมอ
 * เพื่อไม่ให้รหัสของผู้ใช้อื่นถูกเปิดผ่าน ?code= (มีหลายแถวของรหัสเดียวกัน/คนเดียวกัน → เอาล่าสุดก่อน)
 */
export async function getBookingConfirmation(
  bookingCode: string,
  userId: string,
): Promise<BookingConfirmation | null> {
  const [row] = await db
    .select({
      bookingCode: reservation.bookingCode,
      status: reservation.status,
      roomName: rooms.name,
      roomTypeCode: roomType.code,
      bookingDate: reservation.bookingDate,
      startTime: reservation.startTime,
      endTime: reservation.endTime,
    })
    .from(reservation)
    .innerJoin(rooms, eq(reservation.roomId, rooms.id))
    .innerJoin(roomType, eq(rooms.roomTypeId, roomType.id))
    .where(and(eq(reservation.bookingCode, bookingCode), eq(reservation.userId, userId)))
    .orderBy(desc(reservation.createdAt))
    .limit(1);

  return row ?? null;
}

const CONSTRAINT_NAME_PATTERN = /exclusion constraint "([a-z0-9_]+)"/i;

/**
 * อ่านชื่อ constraint จากข้อความ error ที่ violation — ทั้งตัว error เองและ cause
 * (DrizzleQueryError ห่อ pg error ไว้ ข้อความ "Failed query" ของมันไม่มีชื่อ constraint
 *  ส่วน PostgreSQL ไม่ใส่ชื่อ constraint ใน field `constraint` สำหรับ exclusion violations)
 */
function exclusionConstraintName(error: unknown): string | null {
  const direct = pgErrorMessage(error);
  const cause =
    error instanceof Error && error.cause ? pgErrorMessage(error.cause) : null;

  return (
    direct?.match(CONSTRAINT_NAME_PATTERN)?.[1] ??
    cause?.match(CONSTRAINT_NAME_PATTERN)?.[1] ??
    null
  );
}

/**
 * แปลง exclusion constraint ที่ violation เป็นข้อความไทยที่ผู้ใช้เข้าใจ
 * 23P01 บนตาราง reservation มีได้แค่สอง constraint นี้
 */
function mapExclusionViolation(error: unknown): BookingResult | null {
  if (pgErrorCode(error) !== "23P01") {
    return null;
  }

  const constraint = exclusionConstraintName(error);

  if (constraint === "reservation_user_no_overlap") {
    return { ok: false, message: USER_OVERLAP_MESSAGE };
  }

  if (constraint === "reservation_room_exclusive") {
    return { ok: false, message: ROOM_TAKEN_MESSAGE };
  }

  return null;
}
