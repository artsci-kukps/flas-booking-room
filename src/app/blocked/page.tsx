import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/guards";
import StatusPanel from "@/components/status-panel";

// หน้านี้ตั้งใจไว้ "นอก" กลุ่ม (protected) เพราะ requireUser() จะ redirect คนที่ถูกบล็อกมาที่นี่
// ถ้าอยู่ในกลุ่มจะวนลูปไม่รู้จบ
export default async function BlockedPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.isBlocked) {
    redirect("/");
  }

  return (
    <StatusPanel
      tone="danger"
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
          <circle cx="12" cy="12" r="9" />
          <path d="M5.5 5.5l13 13" />
        </svg>
      }
      title="บัญชีนี้ถูกระงับการใช้งาน"
      body="บัญชีของคุณถูกระงับการใช้งานชั่วคราว จึงไม่สามารถใช้ระบบจองห้องได้ หากต้องการใช้งานอีกครั้ง กรุณาติดต่อผู้ดูแลระบบ"
    />
  );
}
