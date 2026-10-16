import type { ReactNode } from "react";

import { requireUserArea } from "@/lib/auth/guards";

/**
 * พื้นที่ผู้ใช้ (/user/*) — มีเส้นทางเป็นของตัวเองคนละชุดกับ /admin
 * แอดมินที่เปิดเส้นทางกลุ่มนี้จะถูกพาไป /admin/booking ผ่าน requireUserArea()
 */
export default async function UserAreaLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireUserArea();

  return <>{children}</>;
}
