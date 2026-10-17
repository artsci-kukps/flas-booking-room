import { redirect } from "next/navigation";

import Alert from "@/components/alert";
import BrandMark from "@/components/brand-mark";
import CreativeSpaceRules from "@/components/login/creative-space-rules";
import { getCurrentUser } from "@/lib/auth/guards";
import EmailPasswordSignInUp from "./email-password-sign-in";

// ข้อความแจ้งเมื่อเข้าสู่ระบบไม่สำเร็จ (คีย์มาจาก query string ?error=)
// ใช้กับเส้นทาง Google OAuth ที่ต้อง redirect กลับมา; การกรอกฟอร์มแสดง inline ใน Alert
const ERROR_NOTICES = {
  "ku-domain": {
    heading: "บัญชีนี้ใช้ไม่ได้",
    body: "ระบบอนุญาตเฉพาะอีเมล @ku.th กรุณาเข้าสู่ระบบใหม่ด้วยบัญชีอีเมลมหาวิทยาลัยของคุณ",
  },
  session: {
    heading: "เข้าสู่ระบบไม่สำเร็จ",
    body: "เกิดข้อผิดพลาดระหว่างเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง",
  },
} as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect(user.role === "admin" ? "/admin/dashboard" : "/user/booking");
  }

  const { error } = await searchParams;
  const notice =
    error === "ku-domain" || error === "session" ? ERROR_NOTICES[error] : null;

  return (
    <main className="flex min-h-dvh flex-col bg-canvas lg:grid lg:h-dvh lg:grid-cols-[1.06fr_0.94fr]">
      {/* ---------- ฝั่งซ้าย: เอกสารกติกาการใช้ห้อง (จาก TOR) ----------
          จอใหญ่ตรึงความสูงไว้ที่หนึ่งหน้าจอ แล้วให้ "คอลัมน์ซ้าย" เลื่อนอ่านเอง
          เพื่อให้การ์ดเข้าสู่ระบบฝั่งขวาอยู่กับที่ไม่เลื่อนตาม */}
      <section className="order-2 flex flex-col border-t border-border px-6 py-10 sm:px-8 lg:order-1 lg:h-dvh lg:overflow-y-auto lg:border-r lg:border-t-0 lg:px-14 lg:py-14">
        <div className="flex items-center gap-3">
          <BrandMark size="lg" />
          <div className="min-w-0">
            <p className="text-[0.9375rem] font-semibold tracking-tight text-ink">
              Creative Space
            </p>
            <p className="text-[0.8125rem] leading-snug text-ink-muted">
              คณะศิลปศาสตร์และวิทยาศาสตร์ · มหาวิทยาลัยเกษตรศาสตร์
              วิทยาเขตกำแพงแสน
            </p>
          </div>
        </div>

        <div className="mt-12 max-w-[50ch] lg:mt-16">
          <h1 className="text-[2.5rem] font-bold leading-[0.98] tracking-[-0.03em] text-ink sm:text-[3.25rem] lg:text-[4.25rem]">
            ระบบจองห้อง
            <span className="text-ku">
              <br />
              Creative Space
            </span>{" "}
          </h1>
          <p className="mt-5 text-base leading-relaxed text-ink-muted">
            ระบบจองห้อง Creative Space สำหรับบุคลากรมหาวิทยาลัยเกษตรศาสตร์
            คณะศิลปศาสตร์และวิทยาศาสตร์
          </p>
        </div>

        <CreativeSpaceRules className="mt-12 lg:mt-14" />
      </section>

      {/* ---------- ฝั่งขวา: ประตูเข้าสู่ระบบ / สมัครสมาชิก ---------- */}
      <aside className="order-1 flex items-center justify-center px-6 py-12 sm:px-8 lg:order-2 lg:h-dvh lg:px-12 lg:py-10">
        <div className="rounded-card w-full max-w-[26rem] border border-border bg-surface p-8 sm:p-10">
          {/* มือถือ: การ์ดมาก่อนเอกสารกติกา จึงต้องมีแบรนด์ให้เห็นตรงจุดตัดสินใจ
              จอใหญ่ซ่อน เพราะมีล็อกอัปแบรนด์อยู่หัวคอลัมน์ซ้ายแล้ว */}
          <div className="mb-6 flex items-center gap-3 border-b border-border pb-6 lg:hidden">
            <BrandMark />
            <div className="min-w-0">
              <p className="text-[0.9375rem] font-semibold tracking-tight text-ink">
                Creative Space
              </p>
              <p className="text-[0.8125rem] leading-snug text-ink-muted">
                คณะศิลปศาสตร์และวิทยาศาสตร์
              </p>
            </div>
          </div>

          {notice ? (
            <Alert
              heading={notice.heading}
              body={notice.body}
              className="mb-6"
            />
          ) : null}

          <EmailPasswordSignInUp />

          <p className="mt-6 flex items-center justify-center gap-1.5 border-t border-border pt-5 text-[0.8125rem] text-ink-muted">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 shrink-0"
              aria-hidden="true"
            >
              <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
              <path d="M9.5 12l1.8 1.8 3.5-3.6" />
            </svg>
            อนุญาตเฉพาะอีเมลที่ลงท้ายด้วย @ku.th
          </p>

          <div className="mt-5 flex items-baseline justify-between gap-4">
            <span className="text-[0.8125rem] text-ink-muted">
              เวลาให้บริการ
            </span>
            <span className="text-[0.8125rem] font-semibold tabular-nums text-ink">
              จันทร์–ศุกร์ 08:30–16:30
            </span>
          </div>
        </div>
      </aside>
    </main>
  );
}
