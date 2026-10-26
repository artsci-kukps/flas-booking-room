import { sendEmail } from "@/services/email.service";
import { renderBookingCancellationEmail } from "@/services/emails/booking-cancellation";
import { renderBookingCodeEmail } from "@/services/emails/booking-code";

/**
 * อีเมลแจ้งเตือนของระบบ (TOR ข้อ 11) — ส่งทันทีผ่าน SMTP (nodemailer)
 * - รหัสการจอง: หนึ่งฉบับต่อการจองหนึ่งระเบียน หลัง transaction commit
 * - ยกเลิกการจอง: หนึ่งฉบับต่อการยกเลิกที่สำเร็จ (ผู้ใช้หรือแอดมิน)
 * อีเมลเป็นงานเสริม: ผู้เรียกต้องถือว่าล้มเหลวไม่ทำให้การจอง/ยกเลิกพัง
 * (ดู `sendAllBestEffort` หรือ catch ในตัวช่วยฝั่งยกเลิก)
 */

export type BookingCodeEmailInput = {
  toEmail: string;
  /** รหัสการจอง 6 หลัก */
  bookingCode: string;
  roomName: string;
  /** 'YYYY-MM-DD' (เขตเวลา Asia/Bangkok) */
  bookingDate: string;
  startTime: Date;
  endTime: Date;
};

export type BookingCancellationEmailInput = BookingCodeEmailInput & {
  /** เหตุผลการยกเลิก — ผู้ใช้ยกเลิกเองไม่มีเหตุผล จึงเป็น null ได้ */
  reason?: string | null;
};

export type SendBookingCodeEmailFn = (
  input: BookingCodeEmailInput,
) => Promise<void>;

export type SendBookingCancellationEmailFn = (
  input: BookingCancellationEmailInput,
) => Promise<void>;

/** ส่งอีเมลรหัสการจองหนึ่งฉบับ — โยน error ออกไปให้ผู้เรียกจัดการ */
export async function sendBookingCodeEmail(
  input: BookingCodeEmailInput,
): Promise<void> {
  const { toEmail, ...booking } = input;

  await sendEmail({ to: toEmail, ...renderBookingCodeEmail(booking) });
}

/** ส่งอีเมลแจ้งเตือนการยกเลิกหนึ่งฉบับ — โยน error ออกไปให้ผู้เรียกจัดการ */
export async function sendBookingCancellationEmail(
  input: BookingCancellationEmailInput,
): Promise<void> {
  const { toEmail, ...booking } = input;

  await sendEmail({ to: toEmail, ...renderBookingCancellationEmail(booking) });
}

/**
 * ส่งหลายฉบับพร้อมกันแบบ best-effort — รอให้จบทุกฉบับแล้ว log เฉพาะที่ล้มเหลว
 * ใช้หลัง commit ของการจองหลาย record เพื่อไม่ให้อีเมลฉบับใดฉบับหนึ่งบล็อกการตอบกลับ
 */
export async function sendAllBestEffort<T>(
  messages: readonly T[],
  send: (message: T) => Promise<void>,
  failureLabel: string,
): Promise<void> {
  if (messages.length === 0) {
    return;
  }

  const results = await Promise.allSettled(messages.map((message) => send(message)));

  for (const result of results) {
    if (result.status === "rejected") {
      console.error(failureLabel, result.reason);
    }
  }
}
