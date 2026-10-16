import type { ReactNode } from "react";

import { requireUser } from "@/lib/auth/guards";
import AppHeader from "@/components/app-header";

/**
 * ทุกเส้นทางในกลุ่ม (protected) ผ่านด่านนี้ — ผู้ที่ไม่มี session ถูกพาไป /login
 * และผู้ที่ถูกบล็อกถูกพาไป /blocked โดยอัตโนมัติ (secure by default)
 * พร้อมแถบเมนูหลักของระบบให้ทุกหน้าใช้ร่วมกัน
 */
export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="min-h-dvh lg:pl-[17.5rem]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ku focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        ข้ามไปยังเนื้อหา
      </a>
      <AppHeader
        user={{
          fullName: user.fullName,
          email: user.email,
          imageUrl: user.imageUrl,
          role: user.role,
        }}
      />
      <div id="main">
        {children}
      </div>
    </div>
  );
}
