import { OTP_TTL_SECONDS } from "@/lib/auth/email-password";
import {
  EMAIL_COLORS,
  EMAIL_FONT_STACK,
  escapeHtml,
  renderEmailLayout,
} from "@/services/emails/layout";

export type OtpEmail = {
  subject: string;
  html: string;
  text: string;
};

type RenderOtpEmailInput = {
  /** รหัส OTP ตัวเลขล้วน */
  code: string;
  /** อายุรหัส (นาที) — ค่าเริ่มต้นตรงกับ OTP_TTL_SECONDS ที่ฝั่ง server ใช้จริง */
  expiresInMinutes?: number;
};

/**
 * เทมเพลตอีเมล "รหัสยืนยันการสมัครสมาชิก" — flat design เดียวกับหน้าเว็บ
 * ไม่มีปุ่ม CTA เพราะผู้ใช้กรอกรหัสอยู่ในหน้าเว็บที่เปิดอยู่แล้ว
 */
export function renderOtpEmail({
  code,
  expiresInMinutes = OTP_TTL_SECONDS / 60,
}: RenderOtpEmailInput): OtpEmail {
  const safeCode = escapeHtml(code);
  const minutes = Math.max(1, Math.round(expiresInMinutes));

  const contentHtml = `
    <h1 style="margin:0;font-size:22px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:${EMAIL_COLORS.ink};">ยืนยันการสมัครสมาชิก</h1>
    <p style="margin:12px 0 0;font-size:15px;line-height:1.7;color:${EMAIL_COLORS.inkMuted};">กรอกรหัสด้านล่างในหน้าเว็บเพื่อยืนยันอีเมลมหาวิทยาลัยของคุณ แล้วระบบจะพาเข้าสู่หน้าจองห้องทันที</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;background-color:${EMAIL_COLORS.kuSoft};border-radius:16px;">
      <tr>
        <td align="center" style="padding:24px 16px;font-family:${EMAIL_FONT_STACK};">
          <div style="font-size:32px;font-weight:700;letter-spacing:0.34em;color:${EMAIL_COLORS.ku};font-variant-numeric:tabular-nums;">${safeCode}</div>
        </td>
      </tr>
    </table>
    <p style="margin:16px 0 0;font-size:14px;line-height:1.7;color:${EMAIL_COLORS.ink};">รหัสนี้ใช้ได้ <strong>${minutes} นาที</strong> และใช้ได้เพียงครั้งเดียว</p>
    <p style="margin:8px 0 0;font-size:14px;line-height:1.7;color:${EMAIL_COLORS.inkMuted};">ถ้าคุณไม่ได้เป็นผู้สมัครสมาชิก ไม่ต้องดำเนินการใด ๆ — รหัสนี้จะหมดอายุเอง</p>
  `;

  const text = [
    "ยืนยันการสมัครสมาชิก Creative Space",
    "",
    `รหัสของคุณ: ${code}`,
    `รหัสนี้ใช้ได้ ${minutes} นาที และใช้ได้เพียงครั้งเดียว`,
    "ถ้าคุณไม่ได้เป็นผู้สมัครสมาชิก ไม่ต้องดำเนินการใด ๆ",
    "",
    "—",
    "คณะศิลปศาสตร์และวิทยาศาสตร์ มหาวิทยาลัยเกษตรศาสตร์ วิทยาเขตกำแพงแสน",
    "ระบบจองห้องทำงาน Creative Space · อีเมลอัตโนมัติ กรุณาอย่าตอบกลับ",
  ].join("\n");

  return {
    subject: `รหัสยืนยันการสมัครสมาชิก Creative Space (ใช้ได้ ${minutes} นาที)`,
    html: renderEmailLayout({
      title: "ยืนยันการสมัครสมาชิก Creative Space",
      preheader: `รหัสยืนยันของคุณคือ ${code} — ใช้ได้ ${minutes} นาที`,
      contentHtml,
    }),
    text,
  };
}
