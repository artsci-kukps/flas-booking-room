/**
 * เชลล์กลางของอีเมลทุกฉบับ — อีเมลต้องใช้ตาราง + inline style เท่านั้น
 * (ไคลเอนต์อีเมลไม่รองรับคลาสหรือ CSS ภายนอก) สีทุกค่าลอกมาจาก globals.css
 * เพื่อให้ภาพลักษณ์ flat เดียวกับหน้าเว็บ: พื้นเทาอุ่น การ์ดขาว เส้นขอบ 1px ไม่มีเงา
 */

export const EMAIL_COLORS = {
  canvas: "#f4f4f1",
  surface: "#ffffff",
  border: "#e3e5e0",
  ink: "#0b0b0c",
  inkMuted: "#5a5f5b",
  ku: "#0e7a4b",
  kuSoft: "#e9f4ee",
} as const;

export const EMAIL_FONT_STACK =
  "'Anuphan', 'Leelawadee UI', Thonburi, 'Segoe UI', system-ui, sans-serif";

const FOOTER_NOTE =
  "คณะศิลปศาสตร์และวิทยาศาสตร์ มหาวิทยาลัยเกษตรศาสตร์ วิทยาเขตกำแพงแสน<br />" +
  "ระบบจองห้องทำงาน Creative Space · อีเมลอัตโนมัติ กรุณาอย่าตอบกลับ";

/** กันข้อความที่แทรกในเทมเพลตหลุดเป็น HTML */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type EmailLayoutInput = {
  /** ข้อความหัวเรื่องของเอกสาร (ไม่แสดงเป็นตัวใหญ่ แต่ช่วยเรื่องการอ่าน) */
  title: string;
  /** ข้อความตัวอย่างที่ไคลเอนต์อีเมลโชว์ข้างหัวเรื่อง (ซ่อนในตัวอีเมล) */
  preheader: string;
  /** เนื้อหาหลัก — ต้องเป็น HTML ที่ escape แล้ว */
  contentHtml: string;
  /** แทนท้ายกระดาษมาตรฐานได้ (เช่น อีเมลที่มีบริบทเฉพาะ) */
  footerHtml?: string;
};

/**
 * ประกอบอีเมล HTML หนึ่งฉบับ: พื้น canvas → การ์ดขาวขอบ 1px → หัวแบรนด์ → เนื้อหา → ท้าย
 * ใช้ตาราง 100% เพื่อให้ Outlook เรนเดอร์ได้ และความกว้างสูงสุด 560px บนจอกว้าง
 */
export function renderEmailLayout({
  title,
  preheader,
  contentHtml,
  footerHtml,
}: EmailLayoutInput): string {
  return `<!DOCTYPE html>
<html lang="th">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${EMAIL_COLORS.canvas};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(
      preheader,
    )}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${EMAIL_COLORS.canvas};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:${EMAIL_COLORS.surface};border:1px solid ${EMAIL_COLORS.border};border-radius:16px;">
            <tr>
              <td style="padding:32px 32px 0;font-family:${EMAIL_FONT_STACK};">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="vertical-align:middle;padding-right:12px;">
                      <span style="display:inline-block;width:40px;height:40px;border-radius:14px;background-color:${EMAIL_COLORS.ku};color:${EMAIL_COLORS.surface};font-size:18px;font-weight:700;line-height:40px;text-align:center;">CS</span>
                    </td>
                    <td style="vertical-align:middle;">
                      <div style="font-size:15px;font-weight:600;color:${EMAIL_COLORS.ink};letter-spacing:-0.01em;">Creative Space</div>
                      <div style="font-size:13px;line-height:1.5;color:${EMAIL_COLORS.inkMuted};">คณะศิลปศาสตร์และวิทยาศาสตร์ · มหาวิทยาลัยเกษตรศาสตร์ วิทยาเขตกำแพงแสน</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px;font-family:${EMAIL_FONT_STACK};color:${EMAIL_COLORS.ink};">
                ${contentHtml}
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid ${EMAIL_COLORS.border};padding:20px 32px 28px;font-family:${EMAIL_FONT_STACK};font-size:12px;line-height:1.7;color:${EMAIL_COLORS.inkMuted};">
                ${footerHtml ?? FOOTER_NOTE}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
