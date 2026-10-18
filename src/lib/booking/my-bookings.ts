import type { Reservation } from "@/db/schema";

import { and, desc, eq, gt } from "drizzle-orm";

import db from "@/db";
import { reservation, roomType, rooms } from "@/db/schema";

/**
 * โดเมนของการจองของฉันและการยกเลิกโดยผู้ใช้ (TOR ข้อ 6.4)
 * ผู้ใช้ยกเลิกได้เฉพาะการจองสถานะ PENDING และต้องทำก่อนเวลาเริ่ม (start_time)
 * เมื่อเป็น ACTIVE แล้วยกเลิกไม่ได้ — ต้องคืนกุญแจก่อน
 *
 * กติกา "ยกเลิกได้หรือไม่" เป็นฟังก์ชันบริสุทธิ์ (cancelability) เพื่อให้ทั้งหน้า
 * และชั้นบันทึกใช้คำตอบเดียวกัน ส่วนที่แตะฐานข้อมูล (listMyBookings / cancelMyReservation)
 * อยู่ท้ายไฟล์นี้
 */

/** สถานะการจองของผู้ใช้ (enum เดียวกับ reservation.status) */
export type BookingStatus = Reservation["status"];

/** ผลการตัดสินว่ายกเลิกได้หรือไม่ — คืนรูปเดียวกันให้ UI แสดงข้อความ inline */
export type Cancelability = { ok: true } | { ok: false; message: string };

/** ข้อความ: การจองกำลังใช้งานอยู่ (ACTIVE) ยกเลิกไม่ได้ (AC ของ ticket #10) */
export const CANCEL_ACTIVE_MESSAGE =
  "การจองนี้กำลังใช้งานอยู่ ยกเลิกไม่ได้ — ต้องคืนกุญแจก่อน";

/** ข้อความ: เลยเวลาเริ่มของการจองแล้ว */
export const CANCEL_STARTED_MESSAGE = "เลยเวลาเริ่มของการจองแล้ว ยกเลิกไม่ได้";

/** ข้อความ: สถานะไม่ใช่ PENDING (ยกเลิกไปแล้ว/เสร็จสิ้น/ไม่มาแสดงตัว) */
export const CANCEL_NOT_PENDING_MESSAGE =
  "ยกเลิกได้เฉพาะการจองที่รอรับกุญแจ (PENDING) เท่านั้น";

/**
 * ตัดสินว่าการจองหนึ่งรายการยกเลิกได้หรือไม่ ณ เวลาที่กำหนด
 * ลำดับการตรวจสำคัญ: ACTIVE ก่อน เพื่อให้ข้อความ "ต้องคืนกุญแจก่อน" ตรงตาม AC
 * แม้เวลาเริ่มจะผ่านไปแล้วก็ตาม
 */
export function cancelability(
  status: BookingStatus,
  startTime: Date,
  now: Date,
): Cancelability {
  if (status === "ACTIVE") {
    return { ok: false, message: CANCEL_ACTIVE_MESSAGE };
  }

  if (status !== "PENDING") {
    return { ok: false, message: CANCEL_NOT_PENDING_MESSAGE };
  }

  if (now >= startTime) {
    return { ok: false, message: CANCEL_STARTED_MESSAGE };
  }

  return { ok: true };
}

// ============================================
// การดึงข้อมูลจริง (DB) สำหรับหน้าประวัติของผู้ใช้
// ============================================

/** หนึ่งรายการจองของฉัน — แถวแคบเท่าที่หน้าประวัติต้องแสดง */
export type MyBooking = {
  id: string;
  bookingCode: string;
  status: BookingStatus;
  roomName: string;
  roomTypeCode: string;
  /** 'YYYY-MM-DD' (booking_date ที่ trigger เซ็ต) */
  bookingDate: string;
  startTime: Date;
  endTime: Date;
  canceledAt: Date | null;
  /** ยกเลิกได้ตอนนี้หรือไม่ (PENDING + ก่อนเวลาเริ่ม) */
  canCancel: boolean;
  /** เหตุผลที่ยกเลิกไม่ได้สำหรับแสดงผล — null เมื่อยกเลิกได้ */
  cancelBlockedMessage: string | null;
};

/**
 * ประวัติการจองทั้งหมดของฉัน เรียงใหม่สุดก่อน (TOR ข้อ 6.3, 6.4)
 * จำกัดด้วย user id ของผู้เรียกเสมอ — เห็นเฉพาะการจองของตัวเอง
 * canCancel คำนวณ ณ เวลาที่เรียก (now) ให้ตรงกับปุ่มที่หน้าจะแสดง
 */
export async function listMyBookings(
  userId: string,
  now: Date = new Date(),
): Promise<MyBooking[]> {
  const rows = await db
    .select({
      id: reservation.id,
      bookingCode: reservation.bookingCode,
      status: reservation.status,
      roomName: rooms.name,
      roomTypeCode: roomType.code,
      bookingDate: reservation.bookingDate,
      startTime: reservation.startTime,
      endTime: reservation.endTime,
      canceledAt: reservation.canceledAt,
    })
    .from(reservation)
    .innerJoin(rooms, eq(reservation.roomId, rooms.id))
    .innerJoin(roomType, eq(rooms.roomTypeId, roomType.id))
    .where(eq(reservation.userId, userId))
    .orderBy(desc(reservation.startTime));

  return rows.map((row) => {
    const verdict = cancelability(row.status, row.startTime, now);

    return {
      ...row,
      canCancel: verdict.ok,
      cancelBlockedMessage: verdict.ok ? null : verdict.message,
    };
  });
}

/** ผลของการยกเลิกการจอง — คืนรูปเดียวกันให้ UI แสดงข้อความ inline */
export type CancelResult = { ok: true } | { ok: false; message: string };

const CANCEL_NOT_FOUND_MESSAGE =
  "ไม่พบรายการจองนี้ หรือไม่ใช่การจองของคุณ กรุณารีเฟรชหน้าแล้วลองใหม่";
const CANCEL_CONFLICT_MESSAGE = "สถานะการจองเปลี่ยนไปแล้ว กรุณารีเฟรชหน้าแล้วลองใหม่";

/**
 * ยกเลิกการจองของตัวเอง (TOR ข้อ 6.4)
 * หลีกเลี่ยง race กับการเปลี่ยนสถานะของแอดมินด้วย UPDATE แบบมีเงื่อนไขเดียว (atomic):
 *   id + เจ้าของ + status = PENDING + start_time > now
 * ถ้าไม่มีแถวถูกแก้ จะ SELECT เพื่ออธิบายเหตุผลให้ผู้ใช้ (ไม่พบ/ACTIVE/เลยเวลา/เปลี่ยนสถานะ)
 *
 * การยกเลิกไม่ต้องระบุเหตุผล (ต่างจากแอดมินที่ต้องระบุ) — TOR ข้อ 6.4
 * เมื่อสถานะเป็น CANCELLED แล้ว exclusion constraint/การนับความจุ (เฉพาะ PENDING/ACTIVE)
 * จะมองข้ามทันที ช่องว่างจึงกลับมาจองได้ทันที
 */
export async function cancelMyReservation(
  reservationId: string,
  userId: string,
  deps: { now?: Date } = {},
): Promise<CancelResult> {
  const now = deps.now ?? new Date();

  const updated = await db
    .update(reservation)
    .set({
      status: "CANCELLED",
      canceledAt: now,
      canceledBy: userId,
      canceledReason: null,
    })
    .where(
      and(
        eq(reservation.id, reservationId),
        eq(reservation.userId, userId),
        eq(reservation.status, "PENDING"),
        gt(reservation.startTime, now),
      ),
    )
    .returning({ id: reservation.id });

  if (updated.length > 0) {
    return { ok: true };
  }

  const [row] = await db
    .select({ status: reservation.status, startTime: reservation.startTime })
    .from(reservation)
    .where(and(eq(reservation.id, reservationId), eq(reservation.userId, userId)))
    .limit(1);

  if (!row) {
    return { ok: false, message: CANCEL_NOT_FOUND_MESSAGE };
  }

  const verdict = cancelability(row.status, row.startTime, now);

  return { ok: false, message: verdict.ok ? CANCEL_CONFLICT_MESSAGE : verdict.message };
}
