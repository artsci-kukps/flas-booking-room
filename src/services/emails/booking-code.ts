import { formatBangkokTime, formatThaiDate } from "@/lib/format";
import {
  EMAIL_COLORS,
  EMAIL_FONT_STACK,
  escapeHtml,
  renderEmailLayout,
} from "@/services/emails/layout";

/**
 * เทมเพลตอีเมล "รหัสการจอง" — ส่งให้ผู้จองทันทีเมื่อจองสำเร็จ (ผ่าน SMTP/nodemailer)
 * รูปแบบ/ภาษา/หัวเรื่องตัดสินในตั๋ว #14 (ภาคผนวก B.2)
 * ไทยล้วน, flat design เดียวกับหน้าเว็บ, ไม่มีปุ่ม CTA (ผู้ใช้เห็นรหัสบนจออยู่แล้ว)
 */

export type BookingCodeEmail = {
  subject: string;
  html: string;
  text: string;
};

export type BookingCodeEmailInput = {
  /** รหัสการจอง 6 หลัก */
  bookingCode: string;
  roomName: string;
  /** 'YYYY-MM-DD' (เขตเวลา Asia/Bangkok) */
  bookingDate: string;
  startTime: Date;
  endTime: Date;
};

/** หัวเรื่องมาตรฐาน — ใช้ทั้งตอนสร้างรายการคิวและตอนส่งจริง */
export function bookingCodeEmailSubject(bookingCode: string): string {
  return `รหัสการจอง Creative Space: ${bookingCode}`;
}

export function renderBookingCodeEmail({
  bookingCode,
  roomName,
  bookingDate,
  startTime,
  endTime,
}: BookingCodeEmailInput): BookingCodeEmail {
  const safeCode = escapeHtml(bookingCode);
  const safeRoom = escapeHtml(roomName);
  const thaiDate = formatThaiDate(bookingDate);
  const start = formatBangkokTime(startTime);
  const end = formatBangkokTime(endTime);
  const timeRange = `${start}–${end} น.`;

  const contentHtml = `
    <h1 style="margin:0;font-size:22px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:${EMAIL_COLORS.ink};">จองห้องสำเร็จ</h1>
    <p style="margin:12px 0 0;font-size:15px;line-height:1.7;color:${EMAIL_COLORS.inkMuted};">เก็บรหัสด้านล่างไว้แล้วแสดงกับเจ้าหน้าที่ ณ จุดรับกุญแจ หากต้องการใช้บริการ</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;background-color:${EMAIL_COLORS.kuSoft};border-radius:16px;">
      <tr>
        <td align="center" style="padding:24px 16px;font-family:${EMAIL_FONT_STACK};">
          <div style="font-size:32px;font-weight:700;letter-spacing:0.34em;color:${EMAIL_COLORS.ku};font-variant-numeric:tabular-nums;">${safeCode}</div>
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
    </table>
    <p style="margin:20px 0 0;font-size:14px;line-height:1.7;color:${EMAIL_COLORS.inkMuted};">รหัสนี้แสดงอยู่ในหน้ายืนยันการจองบนจอด้วยเสมอ — อีเมลฉบับนี้เป็นสำเนาเพื่อความสะดวกเท่านั้น</p>
  `;

  const text = [
    "จองห้องสำเร็จ — Creative Space",
    "",
    `รหัสการจอง: ${bookingCode}`,
    `ห้อง: ${roomName}`,
    `วันเวลา: ${thaiDate} · ${timeRange}`,
    "",
    "เก็บรหัสนี้ไว้แล้วแสดงกับเจ้าหน้าที่ ณ จุดรับกุญแจ",
    "รหัสนี้แสดงอยู่ในหน้ายืนยันการจองบนจอด้วยเสมอ — อีเมลฉบับนี้เป็นสำเนาเพื่อความสะดวกเท่านั้น",
    "",
    "—",
    "คณะศิลปศาสตร์และวิทยาศาสตร์ มหาวิทยาลัยเกษตรศาสตร์ วิทยาเขตกำแพงแสน",
    "ระบบจองห้องทำงาน Creative Space · อีเมลอัตโนมัติ กรุณาอย่าตอบกลับ",
  ].join("\n");

  return {
    subject: bookingCodeEmailSubject(bookingCode),
    html: renderEmailLayout({
      title: "รหัสการจอง Creative Space",
      preheader: `รหัสการจองของคุณคือ ${bookingCode} — ${roomName} ${thaiDate} ${timeRange}`,
      contentHtml,
    }),
    text,
  };
}
