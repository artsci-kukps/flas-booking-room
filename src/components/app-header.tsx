"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

import BrandMark from "@/components/brand-mark";
import SignOutButton from "@/components/sign-out-button";

type HeaderUser = {
  fullName: string | null;
  email: string;
  imageUrl: string | null;
  role: "user" | "admin";
};

type NavItem = {
  href: string;
  label: string;
  /** ใช้เมื่อเมนูหนึ่งแทนพื้นที่ทั้งกลุ่ม เช่น "ศูนย์ควบคุม" แทนทุกเส้นทาง /admin */
  activePrefix?: string;
};

// เมนูของผู้ใช้ทุกคน — แอดมินก็ใช้พื้นที่นี้ได้เหมือนกัน (TOR ข้อ 3.2)
const USER_NAV: NavItem[] = [
  { href: "/user/booking", label: "จองห้อง" },
  { href: "/user/table", label: "ตารางจอง" },
  { href: "/user/history", label: "ประวัติการจอง" },
];

// เมนูย่อยของพื้นที่แอดมิน — แสดงเฉพาะเมื่ออยู่ในเส้นทาง /admin
const ADMIN_NAV: NavItem[] = [
  { href: "/admin/dashboard", label: "ภาพรวม" },
  { href: "/admin/booking-management", label: "การจองและกุญแจ" },
  { href: "/admin/rooms", label: "ห้อง" },
  { href: "/admin/room/type", label: "ประเภทห้อง" },
  { href: "/admin/room/block", label: "บล็อกห้อง" },
  { href: "/admin/holidays", label: "วันหยุด" },
  { href: "/admin/system-setting", label: "ตั้งค่าระบบ" },
  { href: "/admin/users", label: "ผู้ใช้และสิทธิ์" },
];

/** ชื่อสำหรับแสดงบนหัวกระดาษ: เอาชื่อจริง (โทเคนแรก) ถ้ามี ไม่งั้นใช้หน้าอีเมล */
function displayName(user: HeaderUser): string {
  const name = user.fullName?.trim();
  if (name) return name.split(/\s+/)[0]!;
  return user.email.split("@")[0]!;
}

/**
 * แถบเมนูหลักของพื้นที่ล็อกอิน — sticky ด้านบนทุกหน้าใน (protected)
 * แถวบนคือแบรนด์กับบัญชี แถวถัดลงมาเป็นเมนู และแอดมินมีเมนูย่อยของ /admin เพิ่ม
 */
export default function AppHeader({ user }: { user: HeaderUser }) {
  const pathname = usePathname();
  const name = displayName(user);
  const isAdmin = user.role === "admin";
  const homeHref = isAdmin ? "/admin/dashboard" : "/user/booking";
  const inAdminArea = isAdmin && pathname.startsWith("/admin");

  const primaryItems: NavItem[] = [
    ...USER_NAV,
    ...(isAdmin
      ? [
          {
            href: "/admin/dashboard",
            label: "ศูนย์ควบคุม",
            activePrefix: "/admin",
          },
        ]
      : []),
  ];

  const isActive = (item: NavItem) =>
    pathname === item.href ||
    (item.activePrefix !== undefined && pathname.startsWith(item.activePrefix));

  const renderLink = (item: NavItem) => {
    const active = isActive(item);

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`shrink-0 ${
          active
            ? "rounded-[10px] bg-ku-soft px-3 py-1.5 text-sm font-medium text-ku"
            : "rounded-[10px] px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
        }`}
      >
        {item.label}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface">
      <div className="page flex h-14 items-center justify-between gap-3">
        <Link href={homeHref} className="flex items-center gap-2.5">
          <BrandMark />
          <span className="text-[0.9375rem] font-semibold tracking-tight text-ink">
            จองห้องทำงาน
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="hidden max-w-[10rem] truncate text-sm text-ink-muted md:inline">
            {name}
          </span>
          {user.imageUrl ? (
            <Image
              src={user.imageUrl}
              alt=""
              width={32}
              height={32}
              loading="eager"
              className="h-8 w-8 rounded-full"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-ku-soft text-xs font-semibold text-ku"
            >
              {name.charAt(0)}
            </span>
          )}
          <SignOutButton />
        </div>
      </div>

      <nav
        aria-label="เมนูหลัก"
        className="page flex gap-1 overflow-x-auto pb-2"
      >
        {primaryItems.map(renderLink)}
      </nav>

      {inAdminArea ? (
        <nav
          aria-label="เมนูแอดมิน"
          className="border-t border-border bg-surface"
        >
          <div className="page flex gap-1 overflow-x-auto py-2">
            {ADMIN_NAV.map(renderLink)}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
