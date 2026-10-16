import Link from "next/link";

import { requireAdmin } from "@/lib/auth/guards";

import MyBookingsSection from "@/components/booking/my-bookings-section";
import RoomTypesSection from "@/components/booking/room-types-section";
import ServiceHoursSection from "@/components/booking/service-hours-section";
import BookingRulesSection from "@/components/booking/booking-rules-section";

/** ชื่อแสดงบนหัวหน้า: เอาชื่อจริง (โทเคนแรก) ถ้ามี ไม่งั้นใช้หน้าอีเมล */
function displayName(fullName: string | null, email: string): string {
  const name = fullName?.trim();
  if (name) return name.split(/\s+/)[0]!;
  return email.split("@")[0]!;
}

/**
 * หน้าจองห้องของแอดมิน — เนื้อหาและกติกาชุดเดียวกับหน้าผู้ใช้ทุกประการ
 * แต่เป็นคนละเส้นทาง พร้อมทางลัดไปส่วนจัดการจองของระบบ
 */
export default async function AdminBookingPage() {
  const admin = await requireAdmin();
  const name = displayName(admin.fullName, admin.email);

  return (
    <main className="page py-8 sm:py-10">
      <div className="max-w-2xl">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
          จองห้อง
        </h1>
        <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
          สวัสดี, {name} — จองห้องให้ตัวเองแบบเดียวกับผู้ใช้ทั่วไป
          เลือกช่วงเวลาเป็นบล็อกละ 1 ชั่วโมง แล้วยืนยันเพื่อรับรหัส 6
          หลักทางอีเมล
        </p>
      </div>

      <div className="panel mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 p-4 sm:p-5">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-ku-soft text-ku"
        >
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
        </span>
        <p className="min-w-0 flex-1 text-sm leading-relaxed text-ink-muted">
          การจองที่นี่ใช้สิทธิ์และกติกาเดียวกับผู้ใช้ทุกประการ —
          เมื่อมีผู้ใช้นำรหัส 6 หลักมายืนยันรับกุญแจ
          ให้จัดการที่หน้าการจองและรับ–คืนกุญแจ
        </p>
        <Link href="/admin/booking-management" className="btn btn-outline">
          จัดการการจอง
        </Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <MyBookingsSection />
          <RoomTypesSection />
        </div>

        <div className="space-y-6">
          <ServiceHoursSection />
          <BookingRulesSection />
        </div>
      </div>
    </main>
  );
}
