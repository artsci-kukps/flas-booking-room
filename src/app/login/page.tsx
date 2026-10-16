import { getCurrentUser } from "@/lib/auth/guards";
import GoogleSignInButton from "./google-sign-in-button";
import { redirect } from "next/navigation";
import BrandMark from "@/components/brand-mark";

// ข้อความแจ้งเมื่อเข้าสู่ระบบไม่สำเร็จ (คีย์มาจาก query string ?error=)
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
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-6 py-12">
      <div className="panel w-full max-w-[26rem] p-8 sm:p-10">
        <div className="flex flex-col items-center text-center">
          <BrandMark size="lg" />
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink">
            ระบบจองห้องทำงาน
          </h1>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">
            เข้าสู่ระบบด้วยบัญชีอีเมลมหาวิทยาลัย (@ku.th) เท่านั้น
          </p>
        </div>

        {notice ? (
          <div
            role="alert"
            aria-live="polite"
            className="mt-6 flex gap-3 rounded-[10px] border border-danger-line bg-danger-soft p-4 text-left"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-0.5 h-5 w-5 shrink-0 text-danger"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.5v5" />
              <path d="M12 16h.01" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-danger">
                {notice.heading}
              </p>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-danger">
                {notice.body}
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-6">
          <GoogleSignInButton />
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-[0.8125rem] text-ink-muted">
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
      </div>
    </main>
  );
}
