import { and, asc, eq } from "drizzle-orm";

import db from "@/db";
import { reservation, rooms, roomType, users } from "@/db/schema";
import {
  isReservationStatus,
  RESERVATION_STATUSES,
  type ReservationStatus,
} from "@/lib/booking/reservation-status";

import { pgErrorCode, pgErrorMessage } from "./pg-error";

export { isReservationStatus, RESERVATION_STATUSES };
export type { ReservationStatus };

/**
 * ชั้นข้อมูล/โดเมนของตารางจองและการรับ–คืนกุญแจฝั่งแอดมิน (TOR ข้อ 7, 8 · ticket #11)
 * ไม่ใช่ "use server" — server action เป็นเพียงทางเข้า บังคับสิทธิ์แอดมินแล้วเรียกโมดูลนี้
 *
 * กติกาสถานะถูกบังคับ "ที่เงื่อนไข update" ไม่ใช่การอ่านก่อนเขียน เพื่อกันกดซ้ำ/แข่งกัน:
 *   รับกุญแจ ได้เฉพาะ PENDING → ACTIVE
 *   คืนกุญแจ ได้เฉพาะ ACTIVE  → COMPLETED (ตรงเวลา) หรือ LATE_RETURN (เกิน end_time)
 * จึงไม่มีทางรับซ้ำ/คืนซ้ำหรือข้ามสถานะได้ แม้กดพร้อมกัน
 */

/** สถานะการจองทั้ง 6 — ชนิดและตัวตรวจอยู่ใน @/lib/booking/reservation-status (นำเข้าได้ฝั่ง client) */

/** แถวการจองที่หน้าจอแอดมินต้องแสดง — ผู้จอง ช่วงเวลา ห้อง และสถานะ */
export type AdminBookingRow = {
  id: string;
  bookingCode: string;
  bookerName: string;
  bookerEmail: string;
  roomName: string;
  roomTypeCode: string;
  startTime: Date;
  endTime: Date;
  status: ReservationStatus;
};

/** ผลของการยืนยันรับ–คืนกุญแจ — คืนสถานะใหม่ให้ UI แสดงได้ */
export type BookingAdminResult =
  | { ok: true; status: ReservationStatus }
  | { ok: false; message: string };

const NOT_FOUND_MESSAGE = "ไม่พบรายการจองนี้ กรุณารีเฟรชหน้าแล้วลองใหม่";
const PICKUP_NOT_PENDING_MESSAGE =
  "ยืนยันรับกุญแจได้เฉพาะรายการที่รอรับกุญแจ (PENDING) เท่านั้น";
const RETURN_NOT_ACTIVE_MESSAGE =
  "ยืนยันคืนกุญแจได้เฉพาะรายการที่กำลังใช้งาน (ACTIVE) เท่านั้น";

// ---- การยกเลิก/แก้ไขสถานะโดยแอดมิน (ticket #12) ----
const REASON_REQUIRED_MESSAGE = "กรุณาระบุเหตุผลการดำเนินการ";
const REASON_TOO_LONG_MESSAGE = "เหตุผลยาวเกิน 500 ตัวอักษร";
const STATUS_INVALID_MESSAGE = "สถานะที่เลือกไม่ถูกต้อง กรุณาเลือกสถานะใหม่";
const ROOM_TAKEN_OVERRIDE_MESSAGE =
  "ช่วงเวลานี้มีผู้ใช้จองห้องนี้แล้ว ไม่สามารถเปลี่ยนสถานะให้ครองช่วงเวลานี้ได้";
const USER_OVERLAP_OVERRIDE_MESSAGE =
  "ผู้ใช้มีการจองอื่นที่ทับซ้อนช่วงเวลานี้อยู่แล้ว ไม่สามารถเปลี่ยนสถานะให้ครองช่วงเวลานี้ได้";

/** เหตุผลของการยกเลิก/แก้ไขสถานะยาวได้ไม่เกินนี้ */
const MAX_REASON_LENGTH = 500;

/**
 * ตรวจเหตุผลแบบบริสุทธิ์ — บังคับให้มีข้อความจริง และไม่ยาวเกินกำหนด
 * คืนข้อความภาษาไทยเมื่อไม่ผ่าน มิฉะนั้นคืน null
 */
export function validateStatusReason(reason: string): string | null {
  const trimmed = reason.trim();

  if (!trimmed) {
    return REASON_REQUIRED_MESSAGE;
  }

  if (trimmed.length > MAX_REASON_LENGTH) {
    return REASON_TOO_LONG_MESSAGE;
  }

  return null;
}

const CODE_PATTERN = /^\d{6}$/;

/** รหัสการจองต้องเป็นตัวเลข 6 หลัก (TOR ข้อ 6.3) */
export function isBookingCode(value: string): boolean {
  return CODE_PATTERN.test(value);
}

/**
 * สถานะปลายทางเมื่อคืนกุญแจ (TOR ข้อ 7)
 * คืนเกิน `end_time` → LATE_RETURN มิฉะนั้น → COMPLETED (คืนพอดีเวลาไม่นับว่าเกิน)
 */
export function returnedStatus(
  endTime: Date,
  returnedAt: Date,
): "COMPLETED" | "LATE_RETURN" {
  return returnedAt.getTime() > endTime.getTime() ? "LATE_RETURN" : "COMPLETED";
}

/** คอลัมน์ที่หน้าจอใช้ — join ชื่อผู้จอง/ห้อง/รหัสประเภทห้อง */
const BOOKING_COLUMNS = {
  id: reservation.id,
  bookingCode: reservation.bookingCode,
  bookerName: users.fullName,
  bookerEmail: users.email,
  roomName: rooms.name,
  roomTypeCode: roomType.code,
  startTime: reservation.startTime,
  endTime: reservation.endTime,
  status: reservation.status,
};

/** ค่าที่ drizzle select คืน — bookerName เป็น nullable จาก users.full_name */
type BookingRowSource = {
  id: string;
  bookingCode: string;
  bookerName: string | null;
  bookerEmail: string;
  roomName: string;
  roomTypeCode: string;
  startTime: Date;
  endTime: Date;
  status: ReservationStatus;
};

/** แปลงแถวจาก DB เป็นรูปที่ UI ใช้ — ชื่อผู้จองว่างให้ fallback เป็นอีเมล */
function toAdminBookingRow(row: BookingRowSource): AdminBookingRow {
  return {
    id: row.id,
    bookingCode: row.bookingCode,
    bookerName: row.bookerName?.trim() || row.bookerEmail,
    bookerEmail: row.bookerEmail,
    roomName: row.roomName,
    roomTypeCode: row.roomTypeCode,
    startTime: row.startTime,
    endTime: row.endTime,
    status: row.status,
  };
}

/**
 * ตารางการจองของวันหนึ่ง ทุกห้อง (TOR ข้อ 3.2, ticket #11 AC 1)
 * เรียงตามเวลาที่ใช้ห้อง แล้วตามชื่อห้อง
 */
export async function listBookingsForDay(date: string): Promise<AdminBookingRow[]> {
  const rows: BookingRowSource[] = await db
    .select(BOOKING_COLUMNS)
    .from(reservation)
    .innerJoin(rooms, eq(reservation.roomId, rooms.id))
    .innerJoin(roomType, eq(rooms.roomTypeId, roomType.id))
    .innerJoin(users, eq(reservation.userId, users.id))
    .where(eq(reservation.bookingDate, date))
    .orderBy(asc(reservation.startTime), asc(rooms.name));

  return rows.map(toAdminBookingRow);
}

/**
 * ค้นรายการจองด้วยรหัส 6 หลัก จำกัดขอบเขตที่วันเดียว (TOR ข้อ 6.3, ticket #11 AC 2)
 * ผู้เรียกส่งวันปัจจุบันในเขตไทย (todayInBangkok) — รหัสของวันอื่นจะไม่ถูกเปิดเผย
 */
export async function findBookingByCodeOnDay(
  code: string,
  date: string,
): Promise<AdminBookingRow | null> {
  const [row]: BookingRowSource[] = await db
    .select(BOOKING_COLUMNS)
    .from(reservation)
    .innerJoin(rooms, eq(reservation.roomId, rooms.id))
    .innerJoin(roomType, eq(rooms.roomTypeId, roomType.id))
    .innerJoin(users, eq(reservation.userId, users.id))
    .where(
      and(eq(reservation.bookingCode, code), eq(reservation.bookingDate, date)),
    )
    .limit(1);

  return row ? toAdminBookingRow(row) : null;
}

/** อ่านว่ามีแถวจริงอยู่หรือไม่ — ใช้แยกว่า "ไม่พบ" กับ "สถานะไม่ถูกต้อง" */
async function reservationExists(reservationId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: reservation.id })
    .from(reservation)
    .where(eq(reservation.id, reservationId))
    .limit(1);

  return Boolean(row);
}

/**
 * ยืนยันรับกุญแจ: PENDING → ACTIVE พร้อม key_entered_by/at (TOR ข้อ 8)
 * เงื่อนไข `status = 'PENDING'` ใน UPDATE กันรับซ้ำ/รับจากสถานะอื่นแบบ atomic
 */
export async function confirmKeyPickup(
  reservationId: string,
  actorId: string,
  now: Date = new Date(),
): Promise<BookingAdminResult> {
  const updated = await db
    .update(reservation)
    .set({ status: "ACTIVE", keyEnteredAt: now, keyEnteredBy: actorId })
    .where(
      and(eq(reservation.id, reservationId), eq(reservation.status, "PENDING")),
    )
    .returning({ id: reservation.id });

  if (updated.length > 0) {
    return { ok: true, status: "ACTIVE" };
  }

  return {
    ok: false,
    message: (await reservationExists(reservationId))
      ? PICKUP_NOT_PENDING_MESSAGE
      : NOT_FOUND_MESSAGE,
  };
}

/**
 * ยืนยันคืนกุญแจ: ACTIVE → COMPLETED หรือ LATE_RETURN พร้อม key_returned_by/at (TOR ข้อ 7–8)
 * `end_time` ไม่เปลี่ยนหลังสร้าง จึงอ่านมาก่อนตัดสินสถานะได้ ส่วนเงื่อนไข `status = 'ACTIVE'`
 * ใน UPDATE กันคืนซ้ำแบบ atomic
 */
export async function confirmKeyReturn(
  reservationId: string,
  actorId: string,
  now: Date = new Date(),
): Promise<BookingAdminResult> {
  const [row] = await db
    .select({ id: reservation.id, endTime: reservation.endTime })
    .from(reservation)
    .where(eq(reservation.id, reservationId))
    .limit(1);

  if (!row) {
    return { ok: false, message: NOT_FOUND_MESSAGE };
  }

  const status = returnedStatus(row.endTime, now);

  const updated = await db
    .update(reservation)
    .set({ status, keyReturnedAt: now, keyReturnedBy: actorId })
    .where(
      and(eq(reservation.id, reservationId), eq(reservation.status, "ACTIVE")),
    )
    .returning({ id: reservation.id });

  if (updated.length === 0) {
    return { ok: false, message: RETURN_NOT_ACTIVE_MESSAGE };
  }

  return { ok: true, status };
}

// ============================================
// การยกเลิกและแก้ไขสถานะโดยแอดมิน (ticket #12)
// ============================================
// TOR ข้อ 6.4 / 7: แอดมินยกเลิกได้ทุกสถานะ และ override สถานะได้เสมอเมื่อระบบตั้งผิด
// ทุกครั้งต้องระบุเหตุผล และบันทึกผู้ดำเนินการ/เหตุผลลงบนแถวการจอง
// (เวอร์ชันแรกไม่มีตาราง audit รวม — TOR ข้อ 12/A.5 ใช้คอลัมน์
//  canceled_at / canceled_by / canceled_reason เป็นร่องรอยเดียวบนแถว)
//
// การปลดล็อกช่องว่าง: ตั้งสถานะเป็น CANCELLED ทำให้แถวไม่ครองช่วงเวลาอีก
// (exclusion constraint และการนับความจูนับเฉพาะ PENDING/ACTIVE — TOR ข้อ 6.2)
// จึงจองทับได้ทันที

const CONSTRAINT_NAME_PATTERN = /exclusion constraint "([a-z0-9_]+)"/i;

/**
 * อ่านชื่อ exclusion constraint ที่ถูกละเมิด — ทั้งตัว error เองและ cause
 * (DrizzleQueryError ห่อ pg error ไว้ โดยข้อความ "Failed query" ไม่มีชื่อ constraint)
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
 * แปลงข้อผิดพลาดจากการเขียนสถานะเป็นข้อความไทย
 * - 23P01: override กลับไปสถานะที่ครองช่วงแล้วชนการจองที่มีอยู่ (ห้อง/ผู้ใช้)
 * - 22P02: id ที่ไม่ใช่ uuid — มองว่าไม่พบรายการ ไม่ให้ 500
 * คืน null เมื่อไม่รู้จัก เพื่อให้ผู้เรียกโยนต่อ
 */
function statusOverrideErrorMessage(error: unknown): string | null {
  const code = pgErrorCode(error);

  if (code === "22P02") {
    return NOT_FOUND_MESSAGE;
  }

  if (code !== "23P01") {
    return null;
  }

  const constraint = exclusionConstraintName(error);

  if (constraint === "reservation_user_no_overlap") {
    return USER_OVERLAP_OVERRIDE_MESSAGE;
  }

  if (constraint === "reservation_room_exclusive") {
    return ROOM_TAKEN_OVERRIDE_MESSAGE;
  }

  return null;
}

/** เขียนสถานะใหม่ลงแถวการจอง แล้วแปลงข้อผิดพลาดที่รู้จักเป็นข้อความไทย */
async function applyStatusOverride(
  reservationId: string,
  status: ReservationStatus,
  reason: string,
  actorId: string,
  now: Date,
): Promise<BookingAdminResult> {
  try {
    const updated = await db
      .update(reservation)
      .set({
        status,
        canceledAt: now,
        canceledBy: actorId,
        canceledReason: reason.trim(),
      })
      .where(eq(reservation.id, reservationId))
      .returning({ id: reservation.id });

    if (updated.length === 0) {
      return { ok: false, message: NOT_FOUND_MESSAGE };
    }

    return { ok: true, status };
  } catch (error) {
    const mapped = statusOverrideErrorMessage(error);

    if (mapped) {
      return { ok: false, message: mapped };
    }

    throw error;
  }
}

/**
 * ยกเลิกการจอง — ทำได้ทุกสถานะ (TOR ข้อ 6.4) ต้องระบุเหตุผล
 * ตั้งสถานะเป็น CANCELLED ซึ่งทำให้แถวไม่ครองช่วงเวลา ช่องว่างจึงถูกปลดล็อกทันที
 */
export async function cancelReservation(
  reservationId: string,
  reason: string,
  actorId: string,
  now: Date = new Date(),
): Promise<BookingAdminResult> {
  const invalid = validateStatusReason(reason);

  if (invalid) {
    return { ok: false, message: invalid };
  }

  return applyStatusOverride(reservationId, "CANCELLED", reason, actorId, now);
}

/**
 * แก้ไขสถานะการจอง (override) — ทำได้เสมอเมื่อระบบตั้งสถานะผิด (TOR ข้อ 7)
 * เช่นแก้ NO_SHOW ที่ระบบตั้งผิดกลับเป็น ACTIVE พร้อมบันทึกผู้ดำเนินการและเหตุผล
 */
export async function overrideReservationStatus(
  reservationId: string,
  status: string,
  reason: string,
  actorId: string,
  now: Date = new Date(),
): Promise<BookingAdminResult> {
  if (!isReservationStatus(status)) {
    return { ok: false, message: STATUS_INVALID_MESSAGE };
  }

  const invalid = validateStatusReason(reason);

  if (invalid) {
    return { ok: false, message: invalid };
  }

  return applyStatusOverride(reservationId, status, reason, actorId, now);
}
