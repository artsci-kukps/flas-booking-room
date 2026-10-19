import { formatBangkokTime, formatThaiDate } from "@/lib/format";

import {
  EMAIL_COLORS,
  EMAIL_FONT_STACK,
  escapeHtml,
  renderEmailLayout,
} from "./layout";

/**
 * เทมเพลตอีเมลแจ้งเตือนการยกเลิกการจอง (TOR ข้อ 11 · ticket #21)
 * ส่งทั้งเมื่อผู้ใช้ยกเลิกเองและการที่แอดมินยกเลิกให้ — เนื้อหามีรหัสการจอง ห้อง
 * วันเวลาไทย และเหตุผลการยกเลิก (ถ้ามี) ตามรูปแบบเดียวกับอีเมลรหัสการจอง
 * (flat design, ไม่มีปุ่ม CTA, มีข้อความล้วนคู่กับ HTML เสมอ)
 */

export type BookingCancellationEmail = {
  subject: string;
  html: string;
  text: string;
};

export type BookingCancellationEmailInput = {
  /** รหัสการจอง 6 หลัก */
  bookingCode: string;
  roomName: string;
  /** 'YYYY-MM-DD' (เขตเวลา Asia/Bangkok) */
  bookingDate: string;
  startTime: Date;
  endTime: Date;
  /** เหตุผลการยกเลิก — ผู้ใช้ยกเลิกเองไม่มีเหตุผล จึงเป็น null ได้ */
  reason?: string | null;
};

/** หัวเรื่องมาตรฐาน — ใช้ทั้งตอนสร้างรายการคิวและตอนส่งจริง */
export function bookingCancellationEmailSubject(bookingCode: string): string {
  return `ยกเลิกการจอง Creative Space: ${bookingCode}`;
}

export function renderBookingCancellationEmail({
  bookingCode,
  roomName,
  bookingDate,
  startTime,
  endTime,
  reason,
}: BookingCancellationEmailInput): BookingCancellationEmail {
  const safeRoom = escapeHtml(roomName);
  const trimmedReason = reason?.trim() ?? "";
  const thaiDate = formatThaiDate(bookingDate);
  const start = formatBangkokTime(startTime);
  const end = formatBangkokTime(endTime);
  const timeRange = `${start}–${end} น.`;

  const reasonHtml = trimmedReason
    ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;background-color:${EMAIL_COLORS.kuSoft};border-radius:16px;">
      <tr>
        <td style="padding:16px;font-family:${EMAIL_FONT_STACK};font-size:15px;line-height:1.7;color:${EMAIL_COLORS.ink};">
          <div style="font-weight:600;color:${EMAIL_COLORS.inkMuted};">เหตุผลการยกเลิก</div>
          <div style="margin-top:4px;">${escapeHtml(trimmedReason)}</div>
        </td>
      </tr>
    </table>`
    : "";

  const contentHtml = `
    <h1 style="margin:0;font-size:22px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:${EMAIL_COLORS.ink};">ยกเลิกการจองแล้ว</h1>
    <p style="margin:12px 0 0;font-size:15px;line-height:1.7;color:${EMAIL_COLORS.inkMuted};">การจองด้านล่างถูกยกเลิกแล้ว ช่วงเวลานี้กลับมาจองได้อีกครั้ง หากไม่ใช่การดำเนินการของคุณ กรุณาติดต่อเจ้าหน้าที่</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;background-color:${EMAIL_COLORS.kuSoft};border-radius:16px;">
      <tr>
        <td align="center" style="padding:24px 16px;font-family:${EMAIL_FONT_STACK};">
          <div style="font-size:13px;color:${EMAIL_COLORS.inkMuted};">รหัสการจอง</div>
          <div style="font-size:28px;font-weight:700;letter-spacing:0.34em;color:${EMAIL_COLORS.ku};font-variant-numeric:tabular-nums;">${escapeHtml(bookingCode)}</div>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;border-top:1px solid ${EMAIL_COLORS.border};">
      <tr>
        <td style="padding:16px 0 0;font-family:${EMAIL_FONT_STACK};font-size:15px;line-height:1.7;color:${EMAIL_COLORS.ink};">
          <div style="font-weight:600;">${safeRoom}</div>
          <div style="color:${EMAIL_COLORS.inkMuted};">${escapeHtml(thaiDate)} · ${escapeHtml(timeRange)}</div>
        </td>
      </tr>
    </table>${reasonHtml}
    <p style="margin:20px 0 0;font-size:14px;line-height:1.7;color:${EMAIL_COLORS.inkMuted};">ช่องเวลานี้กลับมาจองได้แล้ว หากต้องการใช้บริการสามารถจองใหม่ได้ทันที</p>
  `;

  const text = [
    "ยกเลิกการจอง — Creative Space",
    "",
    `รหัสการจอง: ${bookingCode}`,
    `ห้อง: ${roomName}`,
    `วันเวลา: ${thaiDate} · ${timeRange}`,
    ...(trimmedReason ? ["", `เหตุผลการยกเลิก: ${trimmedReason}`] : []),
    "",
    "การจองนี้ถูกยกเลิกแล้ว ช่องว่างกลับมาจองได้ทันที",
    "",
    "—",
    "คณะศิลปศาสตร์และวิทยาศาสตร์ มหาวิทยาลัยเกษตรศาสตร์ วิทยาเขตกำแพงแสน",
    "ระบบจองห้องทำงาน Creative Space · อีเมลอัตโนมัติ กรุณาอย่าตอบกลับ",
  ].join("\n");

  return {
    subject: bookingCancellationEmailSubject(bookingCode),
    html: renderEmailLayout({
      title: "ยกเลิกการจอง Creative Space",
      preheader: `การจอง ${bookingCode} (${roomName} ${thaiDate} ${timeRange}) ถูกยกเลิกแล้ว`,
      contentHtml,
    }),
    text,
  };
}
