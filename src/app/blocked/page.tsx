import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth/guards'

// หน้าตรวจ session จึงต้องอ่าน request-time data — ปิด instant validation
export const instant = false;

// หน้านี้ตั้งใจไว้ "นอก" กลุ่ม (protected) เพราะ requireUser() จะ redirect คนที่ถูกบล็อกมาที่นี่
// ถ้าอยู่ในกลุ่มจะวนลูปไม่รู้จบ
export default async function BlockedPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  if (!user.isBlocked) {
    redirect('/');
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-6 py-12">
      <div className="w-full max-w-[26rem] rounded-xl border border-border bg-surface p-8 text-center sm:p-10">
        <div
          className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-danger-soft"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6 text-danger"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M5.5 5.5l13 13" />
          </svg>
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink">
          บัญชีนี้ถูกระงับการใช้งาน
        </h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">
          บัญชีของคุณถูกระงับการใช้งานชั่วคราว จึงไม่สามารถใช้ระบบจองห้องได้
          หากต้องการใช้งานอีกครั้ง กรุณาติดต่อผู้ดูแลระบบ
        </p>
      </div>
    </main>
  );
}
