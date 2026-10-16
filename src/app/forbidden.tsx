import Link from "next/link";

/**
 * UI ที่แสดงเมื่อมีคนเรียก forbidden() (403) — เช่น ผู้ใช้ทั่วไปเปิดเส้นทางแอดมิน
 * Next.js จะใส่ <meta name="robots" content="noindex" /> ให้เอง
 */
export default function Forbidden() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-6 py-12">
      <div className="w-full max-w-[26rem] rounded-xl border border-border bg-surface p-8 text-center sm:p-10">
        <p className="text-sm font-semibold tracking-widest text-danger">403</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
          ไม่มีสิทธิ์เข้าถึง
        </h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">
          บัญชีของคุณไม่มีสิทธิ์เข้าถึงหน้านี้ หากคิดว่าเป็นความผิดพลาด
          กรุณาติดต่อผู้ดูแลระบบ
        </p>
        <Link
          href="/user "
          className="mt-6 inline-flex h-11 items-center justify-center rounded-[10px] bg-ku px-6 font-semibold text-white transition-colors hover:bg-ku-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ku focus-visible:ring-offset-2"
        >
          กลับไปหน้าของฉัน
        </Link>
      </div>
    </main>
  );
}
