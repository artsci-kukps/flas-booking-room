/**
 * ตัวส่งอีเมลผ่าน Resend (REST API โดยตรง ไม่เพิ่ม dependency)
 * - อ่านค่าเชื่อมต่อจาก env ตอน "ส่งจริง" เท่านั้น เพื่อให้ import ในเทสต์ได้โดยไม่ต้องมี env
 * - ฉีด fetch ได้ (fetchImpl) — เทสต์ไม่ยิงเครือข่ายจริงและไม่ใช้ API key จริง
 * - โยน error ออกไปให้ caller (คิว outbox) เก็บเป็น last_error และจัด retry เอง
 */

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailSender = (message: EmailMessage) => Promise<void>;

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type ResendSenderDeps = {
  apiKey?: string;
  from?: string;
  fetchImpl?: typeof fetch;
  endpoint?: string;
};

export function createResendSender(deps: ResendSenderDeps = {}): EmailSender {
  return async (message) => {
    const apiKey = deps.apiKey ?? process.env.RESEND_API_KEY;
    const from = deps.from ?? process.env.RESEND_FROM ?? process.env.EMAIL_FROM;
    const fetchImpl = deps.fetchImpl ?? fetch;
    const endpoint = deps.endpoint ?? RESEND_ENDPOINT;

    if (!apiKey) {
      throw new Error("ไม่พบ RESEND_API_KEY สำหรับส่งอีเมลผ่าน Resend");
    }

    if (!from) {
      throw new Error("ไม่พบ RESEND_FROM สำหรับส่งอีเมลผ่าน Resend");
    }

    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      const suffix = detail ? `: ${detail.slice(0, 500)}` : "";
      throw new Error(`Resend ตอบกลับ ${response.status}${suffix}`);
    }
  };
}

/** ตัวส่งเริ่มต้นของแอป — อ่าน env เมื่อถูกเรียกจริง */
export const sendEmailViaResend: EmailSender = createResendSender();
