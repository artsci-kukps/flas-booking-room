import { createTransport, type Transporter } from "nodemailer";

/**
 * บริการส่งอีเมลผ่าน SMTP (nodemailer)
 * สร้าง transporter แบบ lazy และใช้ซ้ำ — ค่าเชื่อมต่ออ่านจาก env ตอนส่งจริงเท่านั้น
 */

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT ?? 465);
    const user = process.env.SMTP_USER;

    transporter = createTransport({
      host: process.env.SMTP_HOST,
      port,
      // พอร์ต 465 ใช้ TLS ตั้งแต่ต้นทาง (SMTP_PORT=465 ใน .env)
      secure: port === 465,
      auth: user ? { user, pass: process.env.SMTP_PASS } : undefined,
    });
  }

  return transporter;
}

/** ส่งอีเมลหนึ่งฉบับ — โยน error ออกไปให้ผู้เรียกจัดการ (เช่น แสดง Alert) */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;

  if (!from) {
    throw new Error("ไม่พบ SMTP_FROM / SMTP_USER สำหรับส่งอีเมล");
  }

  await getTransporter().sendMail({
    from,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
}
