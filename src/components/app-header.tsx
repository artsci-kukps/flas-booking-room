"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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

type IconName =
  | "booking"
  | "table"
  | "history"
  | "dashboard"
  | "key"
  | "door"
  | "layers"
  | "block"
  | "holiday"
  | "sliders"
  | "users";

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  /** ใช้เมื่อเมนูหนึ่งแทนพื้นที่ทั้งกลุ่ม เช่น "ศูนย์ควบคุม" แทนทุกเส้นทาง /admin */
  activePrefix?: string;
};

// เมนูพื้นที่ทำงานของผู้ใช้ทั่วไป — เส้นทาง /user ทั้งหมด
const USER_NAV: NavItem[] = [
  { href: "/user/booking", label: "จองห้อง", icon: "booking" },
  { href: "/user/table", label: "ตารางจอง", icon: "table" },
  { href: "/user/history", label: "ประวัติการจอง", icon: "history" },
];

// เมนูพื้นที่ทำงานของแอดมิน — มีเส้นทางเป็นของตัวเอง ไม่ใช้ /user ร่วมกับผู้ใช้
const ADMIN_WORK_NAV: NavItem[] = [
  { href: "/admin/booking", label: "จองห้อง", icon: "booking" },
  { href: "/admin/table", label: "ตารางจอง", icon: "table" },
  { href: "/admin/history", label: "ประวัติการจอง", icon: "history" },
  { href: "/admin/dashboard", label: "ศูนย์ควบคุม", icon: "dashboard" },
];

// เมนูจัดการระบบ — กลุ่มที่สองของแอดมิน ชี้ไปยังหน้าจัดการของระบบ
const ADMIN_CONTROL_NAV: NavItem[] = [
  { href: "/admin/booking-management", label: "การจองและกุญแจ", icon: "key" },
  { href: "/admin/rooms", label: "ห้อง", icon: "door" },
  { href: "/admin/room/type", label: "ประเภทห้อง", icon: "layers" },
  { href: "/admin/room/block", label: "บล็อกห้อง", icon: "block" },
  { href: "/admin/holidays", label: "วันหยุด", icon: "holiday" },
  { href: "/admin/system-setting", label: "ตั้งค่าระบบ", icon: "sliders" },
  { href: "/admin/users", label: "ผู้ใช้และสิทธิ์", icon: "users" },
];

// ไอคอนที่เขียนเองทุกใบ น้ำหนักเส้น 1.8 เท่ากันทั้งระบบ (ไม่ใช้ emoji)
const ICON_PATHS: Record<IconName, ReactNode> = {
  booking: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M3 10h18" />
      <path d="M12 13v6" />
      <path d="M9 16h6" />
    </>
  ),
  table: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 10h18" />
      <path d="M9 10v11" />
      <path d="M15 10v11" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v4h4" />
      <path d="M12 7.5v4.7l3 1.8" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="5" rx="2" />
      <rect x="13" y="11" width="8" height="10" rx="2" />
      <rect x="3" y="14" width="8" height="7" rx="2" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="16" r="4" />
      <path d="M10.9 13.1 20 4" />
      <path d="m16.5 7.5 3.5 3.5" />
    </>
  ),
  door: (
    <>
      <path d="M6 20V7a6 6 0 0 1 12 0v13" />
      <path d="M4 20h16" />
      <circle cx="12" cy="11" r="1.4" />
      <path d="M12 12.4v2.6" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </>
  ),
  block: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6l12.8 12.8" />
    </>
  ),
  holiday: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M3 10h18" />
      <path d="m10 14 4 4" />
      <path d="m14 14-4 4" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 8h9.5" />
      <circle cx="15.5" cy="8" r="2" />
      <path d="M17.5 8H20" />
      <path d="M4 16h2.5" />
      <circle cx="8.5" cy="16" r="2" />
      <path d="M10.5 16H20" />
    </>
  ),
  users: (
    <>
      <path d="M15.6 20v-1.8a3.6 3.6 0 0 0-3.6-3.6H6.6A3.6 3.6 0 0 0 3 18.2V20" />
      <circle cx="9.3" cy="8" r="3.6" />
      <path d="M21 20v-1.8a3.6 3.6 0 0 0-2.7-3.5" />
      <path d="M15.6 4.3a3.6 3.6 0 0 1 0 7" />
    </>
  ),
};

const ROLE_LABEL = {
  user: "ผู้ใช้งาน",
  admin: "ผู้ดูแลระบบ",
} as const;

/** ชื่อสำหรับแสดงบนหัวกระดาษ: เอาชื่อจริง (โทเคนแรก) ถ้ามี ไม่งั้นใช้หน้าอีเมล */
function displayName(user: HeaderUser): string {
  const name = user.fullName?.trim();
  if (name) return name.split(/\s+/)[0]!;
  return user.email.split("@")[0]!;
}

function NavIcon({ name }: { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px] shrink-0"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

/**
 * เปลือกของพื้นที่ล็อกอิน — แถบข้าง (sidebar) บนจอใหญ่ และแถบบนแบบเปิดเมนูได้บนมือถือ
 * ผู้ใช้เห็นเฉพาะเส้นทาง /user ส่วนแอดมินเห็นเฉพาะเส้นทาง /admin
 * โดยแอดมินมีสองกลุ่ม: พื้นที่ทำงานของตัวเอง และเมนูศูนย์ควบคุม
 */
export default function AppHeader({ user }: { user: HeaderUser }) {
  const pathname = usePathname();
  // เก็บเส้นทางที่เปิดเมนูไว้ — พอเปลี่ยนหน้า ค่าจะไม่ตรงกับ pathname แล้วเมนูปิดเอง
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;
  const asideRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeMenu = () => {
    setOpenedAt(null);
    toggleRef.current?.focus();
  };
  const toggleMenu = () =>
    setOpenedAt((previous) => (previous === pathname ? null : pathname));

  // เมนูมือถือ: ปุ่ม Esc ปิด และล็อกโฟกัสให้วนอยู่ในแถบข้างระหว่างเปิด
  useEffect(() => {
    if (!open) return;
    const aside = asideRef.current;
    const focusables = () =>
      aside
        ? Array.from(
            aside.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
          )
        : [];

    // effect ของอีเวนต์คลิกอาจทำงานก่อนเบราว์เซอร์คำนวณสไตล์ใหม่
    // จึงบังคับให้คำนวณสไตล์ (อ่าน offsetHeight) เพื่อให้ visibility:visible มีผลก่อนย้ายโฟกัส
    // การเปลี่ยน visibility เป็น transition: ค่า computed จะยังเป็น hidden
    // จนกว่า transition จะเริ่มในเฟรมถัดไป จึงรอสองเฟรมก่อนย้ายโฟกัส
    let cancelled = false;
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!cancelled) focusables()[0]?.focus();
      }),
    );

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpenedAt(null);
        toggleRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;

      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
  const name = displayName(user);
  const isAdmin = user.role === "admin";
  const homeHref = isAdmin ? "/admin/dashboard" : "/user/booking";
  const workItems: NavItem[] = isAdmin ? ADMIN_WORK_NAV : USER_NAV;

  const isActive = (item: NavItem) =>
    pathname === item.href ||
    (item.activePrefix !== undefined && pathname.startsWith(item.activePrefix));

  const renderLink = (item: NavItem) => {
    const active = isActive(item);

    return (
      <Link
        key={item.href}
        aria-current={active ? "page" : undefined}
        href={item.href}
        className={`flex items-center gap-3 rounded-[12px] px-3 py-2 text-sm transition-colors ${
          active
            ? "bg-ku-soft font-semibold text-ku"
            : "font-medium text-ink-muted hover:bg-canvas hover:text-ink"
        }`}
      >
        <NavIcon name={item.icon} />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  const avatar = user.imageUrl ? (
    <Image
      src={user.imageUrl}
      alt=""
      width={36}
      height={36}
      loading="eager"
      className="h-9 w-9 shrink-0 rounded-full"
    />
  ) : (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ku-soft text-sm font-semibold text-ku"
    >
      {name.charAt(0)}
    </span>
  );

  return (
    <>
      {/* แถบบนสำหรับมือถือ — จอใหญ่ซ่อน เพราะใช้แถบข้างแทน */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface lg:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Link href={homeHref} className="flex items-center gap-2.5">
            <BrandMark />
            <span className="text-[0.9375rem] font-semibold tracking-tight text-ink">
              จองห้องทำงาน
            </span>
          </Link>
          <button
            type="button"
            ref={toggleRef}
            onClick={toggleMenu}
            aria-expanded={open}
            aria-controls="app-sidebar"
            aria-label={open ? "ปิดเมนู" : "เปิดเมนู"}
            className="icon-btn"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              {open ? (
                <>
                  <path d="m6 6 12 12" />
                  <path d="m18 6-12 12" />
                </>
              ) : (
                <>
                  <path d="M4 7h16" />
                  <path d="M4 12h16" />
                  <path d="M4 17h16" />
                </>
              )}
            </svg>
          </button>
        </div>
      </header>

      {/* ฉากมืดเมื่อเปิดเมนูบนมือถือ */}
      <div
        aria-hidden="true"
        onClick={closeMenu}
        className={`fixed inset-0 z-20 bg-ink/25 transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        id="app-sidebar"
        ref={asideRef}
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-[17.5rem] flex-col border-r border-border bg-surface transition-[transform,visibility] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:visible lg:translate-x-0 ${
          open ? "visible translate-x-0" : "invisible -translate-x-full"
        }`}
      >
        <Link href={homeHref} className="flex items-center gap-2.5 px-4 py-5">
          <BrandMark />
          <span className="min-w-0">
            <span className="block truncate text-[0.9375rem] font-semibold tracking-tight text-ink">
              จองห้องทำงาน
            </span>
            <span className="block truncate text-[0.75rem] text-ink-muted">
              คณะศิลปศาสตร์และวิทยาศาสตร์
            </span>
          </span>
        </Link>

        <nav aria-label="เมนูหลัก" className="flex-1 overflow-y-auto px-3 pb-3">
          <p className="px-3 pb-1 pt-3 text-[0.75rem] font-semibold text-ink-muted">
            พื้นที่ทำงาน
          </p>
          <div className="flex flex-col gap-0.5">
            {workItems.map((item) => renderLink(item))}
          </div>

          {isAdmin ? (
            <>
              <p className="px-3 pb-1 pt-5 text-[0.75rem] font-semibold text-ink-muted">
                จัดการระบบ
              </p>
              <div className="flex flex-col gap-0.5">
                {ADMIN_CONTROL_NAV.map((item) => renderLink(item))}
              </div>
            </>
          ) : null}
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 px-1 py-1.5">
            {avatar}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{name}</p>
              <p className="truncate text-xs text-ink-muted">
                {ROLE_LABEL[user.role]}
              </p>
            </div>
          </div>
          <SignOutButton variant="labeled" className="mt-2 w-full" />
        </div>
      </aside>
    </>
  );
}
