import { eq } from "drizzle-orm";

import db from "@/db";
import { reservation, rooms, users } from "@/db/schema";

import {
  sendBookingCancellationEmail,
  type SendBookingCancellationEmailFn,
} from "./email";

/**
 * ทางเข้าร่วมของอีเมลแจ้งเตือนการยกเลิกการจอง (ticket #21)
 * ใช้ทั้งเมื่อผู้ใช้ยกเลิกเองและเมื่อแอดมินยกเลิก — ดึงรหัสการจอง/ห้อง/วันเวลา/อีเมลผู้จอง
 * จากฐานข้อมูลแล้วส่งอีเมลทันทีผ่าน SMTP
 *
 * อีเมลเป็นการแจ้งเตือน "แบบเสริม": งานนี้กลืนข้อผิดพลาดทั้งหมด (log แล้วจบ)
 * เพื่อให้การยกเลิกล้มเหลวไม่ได้เพราะอีเมลขัดข้อง — เหมือนการส่งรหัสการจอง
 */

export type SendCancellationDeps = {
  /** ฉีดได้เพื่อเทสต์ — ค่าเริ่มต้นส่งผ่าน SMTP จริง */
  send?: SendBookingCancellationEmailFn;
};

type CancellationDetails = {
  bookingCode: string;
  roomName: string;
  bookingDate: string;
  startTime: Date;
  endTime: Date;
  toEmail: string | null;
};

/**
 * ดึงข้อมูลการจองตาม id แล้วส่งอีเมลแจ้งเตือนการยกเลิก (best-effort)
 * reason เป็น null ได้เมื่อผู้ใช้ยกเลิกเอง (ไม่ต้องระบุเหตุผล)
 */
export async function sendBookingCancellationForReservation(
  reservationId: string,
  reason: string | null,
  deps: SendCancellationDeps = {},
): Promise<void> {
  const send = deps.send ?? sendBookingCancellationEmail;

  try {
    const [details]: CancellationDetails[] = await db
      .select({
        bookingCode: reservation.bookingCode,
        roomName: rooms.name,
        bookingDate: reservation.bookingDate,
        startTime: reservation.startTime,
        endTime: reservation.endTime,
        toEmail: users.email,
      })
      .from(reservation)
      .innerJoin(rooms, eq(reservation.roomId, rooms.id))
      .innerJoin(users, eq(reservation.userId, users.id))
      .where(eq(reservation.id, reservationId))
      .limit(1);

    if (!details?.toEmail) {
      return;
    }

    await send({
      toEmail: details.toEmail,
      bookingCode: details.bookingCode,
      roomName: details.roomName,
      bookingDate: details.bookingDate,
      startTime: details.startTime,
      endTime: details.endTime,
      reason: reason?.trim() || null,
    });
  } catch (error) {
    console.error("ส่งอีเมลแจ้งเตือนการยกเลิกการจองไม่สำเร็จ", error);
  }
}
