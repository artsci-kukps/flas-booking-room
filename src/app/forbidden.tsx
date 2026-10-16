import Link from "next/link";

import StatusPanel from "@/components/status-panel";

/**
 * UI ที่แสดงเมื่อมีคนเรียก forbidden() (403) — เช่น ผู้ใช้ทั่วไปเปิดเส้นทางแอดมิน
 * Next.js จะใส่ <meta name="robots" content="noindex" /> ให้เอง
 */
export default function Forbidden() {
  return (
    <StatusPanel
      code="403"
      icon={
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      }
      title="ไม่มีสิทธิ์เข้าถึง"
      body="บัญชีของคุณไม่มีสิทธิ์เข้าถึงหน้านี้ หากคิดว่าเป็นความผิดพลาด กรุณาติดต่อผู้ดูแลระบบ"
      action={
        <Link href="/user/booking" className="btn btn-primary mt-6">
          กลับไปหน้าของฉัน
        </Link>
      }
    />
  );
}
