import { and, asc, eq } from "drizzle-orm";

import db from "@/db";
import { reservation, rooms, roomType, users, type Reservation } from "@/db/schema";

/**
 * ชั้นข้อมูล/โดเมนของตารางจองและการรับ–คืนกุญแจฝั่งแอดมิน (TOR ข้อ 7, 8 · ticket #11)
 * ไม่ใช่ "use server" — server action เป็นเพียงทางเข้า บังคับสิทธิ์แอดมินแล้วเรียกโมดูลนี้
 *
 * กติกาสถานะถูกบังคับ "ที่เงื่อนไข update" ไม่ใช่การอ่านก่อนเขียน เพื่อกันกดซ้ำ/แข่งกัน:
 *   รับกุญแจ ได้เฉพาะ PENDING → ACTIVE
 *   คืนกุญแจ ได้เฉพาะ ACTIVE  → COMPLETED (ตรงเวลา) หรือ LATE_RETURN (เกิน end_time)
 * จึงไม่มีทางรับซ้ำ/คืนซ้ำหรือข้ามสถานะได้ แม้กดพร้อมกัน
 */

/** สถานะการจองทั้ง 6 (ตาม enum ในฐานข้อมูล) */
export type ReservationStatus = Reservation["status"];

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
