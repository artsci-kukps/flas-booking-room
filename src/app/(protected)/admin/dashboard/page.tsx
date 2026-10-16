import Link from "next/link";

import { requireAdmin } from "@/lib/auth/guards";

// พื้นที่จัดการตามขอบเขตใน TOR — ไอคอน stroked 1.8 เหมือนกันทุกใบ
// แต่ละใบชี้ไปยังหน้าจริงของพื้นที่แอดมิน
const ADMIN_AREAS = [
  {
    href: "/admin/booking-management",
    title: "การจองและรับ–คืนกุญแจ",
    desc: "ดูตารางการจองทั้งระบบ ยืนยันรับ–คืนกุญแจด้วยรหัส 6 หลัก และยกเลิกการจองพร้อมเหตุผล",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4" />
        <path d="M16 3v4" />
        <path d="M3 10h18" />
        <path d="m9 15 2 2 4-4" />
      </svg>
    ),
  },
  {
    href: "/admin/rooms",
    title: "ห้องและประเภทห้อง",
    desc: "เพิ่ม แก้ไข และกู้คืนห้องที่ถูกลบ พร้อมจัดการประเภทห้อง สิ่งอำนวยความสะดวก และความจุ",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <path d="M6 20V7a6 6 0 0 1 12 0v13" />
        <path d="M4 20h16" />
        <circle cx="12" cy="11" r="1.4" />
        <path d="M12 12.4v2.6" />
      </svg>
    ),
  },
  {
    href: "/admin/system-setting",
    title: "เวลาให้บริการ",
    desc: "ตั้งเวลาเปิด–ปิดของวันปกติ และขยายเวลาในช่วงสอบ โดยไม่ต้องแก้โค้ด",
    icon: (
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
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    href: "/admin/holidays",
    title: "วันหยุดนักขัตฤกษ์",
    desc: "เพิ่มหรือลบวันหยุด เพื่อปิดระบบจองทั้งหมดเฉพาะวันที่กำหนด",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4" />
        <path d="M16 3v4" />
        <path d="M3 10h18" />
        <path d="m10 14 4 4" />
        <path d="m14 14-4 4" />
      </svg>
    ),
  },
  {
    href: "/admin/room/block",
    title: "บล็อกห้อง",
    desc: "ปิดปรับปรุงห้องเป็นช่วงเวลา พร้อมเหตุผลที่บันทึกไว้กับรายการ",
    icon: (
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
        <path d="M5.6 5.6l12.8 12.8" />
      </svg>
    ),
  },
  {
    href: "/admin/users",
    title: "ผู้ใช้และสิทธิ์",
    desc: "เปลี่ยนบทบาท และระงับหรือปลดระงับบัญชี — ระบบไม่มีการลบผู้ใช้เด็ดขาด",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9.5" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
] as const;

export default async function AdminPage() {
  const admin = await requireAdmin();

  return (
    <main className="page py-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
            ศูนย์ควบคุม
          </h1>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
            ยินดีต้อนรับ {admin.fullName ?? admin.email} — คุณเข้าสู่ระบบในฐานะผู้ดูแลระบบ
          </p>
        </div>
        <Link href="/user/booking" className="btn btn-primary">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[18px] w-[18px]"
            aria-hidden="true"
          >
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M8 3v4" />
            <path d="M16 3v4" />
            <path d="M3 10h18" />
          </svg>
          ไปยังหน้าผู้ใช้
        </Link>
      </div>

      <section aria-labelledby="admin-areas" className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2
            id="admin-areas"
            className="text-base font-semibold tracking-tight text-ink"
          >
            พื้นที่จัดการ
          </h2>
          <p className="text-[0.8125rem] text-ink-muted">
            ฟังก์ชันส่วนใหญ่อยู่ระหว่างพัฒนา ตามขอบเขตที่กำหนดไว้ใน TOR
          </p>
        </div>
        <div className="panel mt-3 overflow-hidden">
          <div className="grid gap-px bg-border md:grid-cols-2">
            {ADMIN_AREAS.map((area) => (
              <Link
                key={area.href}
                href={area.href}
                className="group flex gap-4 bg-surface p-5 transition-colors hover:bg-canvas"
              >
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-canvas text-ink-muted transition-colors group-hover:bg-ku-soft group-hover:text-ku"
                >
                  {area.icon}
                </span>
                <div>
                  <p className="font-semibold text-ink transition-colors group-hover:text-ku">
                    {area.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                    {area.desc}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-6 flex gap-3 rounded-xl bg-ku-soft p-4">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-0.5 h-5 w-5 shrink-0 text-ku"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5" />
          <path d="M12 8h.01" />
        </svg>
        <p className="text-sm leading-relaxed text-ink">
          แอดมินสามารถจองห้องได้เช่นเดียวกับผู้ใช้ทั่วไป
          โดยใช้สิทธิ์และกติกาการจองเดียวกันทุกประการ
        </p>
      </div>
    </main>
  );
}
