import { eq } from "drizzle-orm";

import db from "@/db";
import { reservation, rooms, users } from "@/db/schema";

import {
  enqueueBookingCancellationEmail,
  type EnqueueBookingCancellationEmailFn,
} from "./outbox";

/**
 * ทางเข้าร่วมของการเข้าคิวอีเมลยกเลิกการจอง (ticket #21)
 * ใช้ทั้งเมื่อผู้ใช้ยกเลิกเองและเมื่อแอดมินยกเลิก — ดึงรหัสการจอง/ห้อง/วันเวลา/อีเมลผู้จอง
 * จากฐานข้อมูลแล้วเข้าคิวเป็น type BOOKING_CANCELLED
 *
 * อีเมลเป็นการแจ้งเตือน "แบบเสริม": งานนี้กลืนข้อผิดพลาดทั้งหมด (log แล้วจบ)
 * เพื่อให้การยกเลิกล้มเหลวไม่ได้เพราะคิว/อีเมลขัดข้อง — เหมือนการเข้าคิวรหัสการจอง
 */

export type EnqueueCancellationDeps = {
  /** ฉีดได้เพื่อเทสต์ — ค่าเริ่มต้นเขียนลง notification_outbox จริง */
  enqueue?: EnqueueBookingCancellationEmailFn;
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
 * ดึงข้อมูลการจองตาม id แล้วเข้าคิวอีเมลแจ้งเตือนการยกเลิก (best-effort)
 * reason เป็น null ได้เมื่อผู้ใช้ยกเลิกเอง (ไม่ต้องระบุเหตุผล)
 */
export async function enqueueBookingCancellationForReservation(
  reservationId: string,
  reason: string | null,
  deps: EnqueueCancellationDeps = {},
): Promise<void> {
  const enqueue = deps.enqueue ?? enqueueBookingCancellationEmail;

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

    await enqueue({
      reservationId,
      toEmail: details.toEmail,
      bookingCode: details.bookingCode,
      roomName: details.roomName,
      bookingDate: details.bookingDate,
      startTime: details.startTime,
      endTime: details.endTime,
      reason,
    });
  } catch (error) {
    console.error("เข้าคิวแจ้งเตือนการยกเลิกการจองไม่สำเร็จ", error);
  }
}
