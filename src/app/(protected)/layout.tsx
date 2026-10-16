import type { ReactNode } from "react";

import { requireUser } from "@/lib/auth/guards";
/**
 * ทุกเส้นทางในกลุ่ม (protected) ผ่านด่านนี้ — ผู้ที่ไม่มี session ถูกพาไป /login
 * และผู้ที่ถูกบล็อกถูกพาไป /blocked โดยอัตโนมัติ (secure by default)
 */
export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireUser();

  return <>{children}</>;
}
