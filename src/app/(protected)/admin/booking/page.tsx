import Link from "next/link";

import BookingFlow from "@/components/booking/booking-flow";
import MyBookingsSection from "@/components/booking/my-bookings-section";
import RoomTypesSection from "@/components/booking/room-types-section";
import ServiceHoursSection from "@/components/booking/service-hours-section";
import BookingRulesSection from "@/components/booking/booking-rules-section";
import { requireAdmin } from "@/lib/auth/guards";
import { todayInBangkok } from "@/lib/admin/service-periods";
import { parseBookingDate, parseBookingRoomId } from "@/lib/booking/booking-date";

import { bookRoom } from "./actions";

/** ชื่อแสดงบนหัวหน้า: เอาชื่อจริง (โทเคนแรก) ถ้ามี ไม่งั้นใช้หน้าอีเมล */
function displayName(fullName: string | null, email: string): string {
  const name = fullName?.trim();
  if (name) return name.split(/\s+/)[0]!;
  return email.split("@")[0]!;
}

/**
 * หน้าจองห้องของแอดมิน — ใช้ขั้นตอนการจองชุดเดียวกับผู้ใช้ (ผนังห้อง → popup จองครบวงจร:
 * เลือกวัน วันนี้/วันพรุ่งนี้ → เลือกบล็อกเวลา → ยืนยัน) ต่างกันที่ server action ของพื้นที่ /admin
 */
export default async function AdminBookingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  const name = displayName(admin.fullName, admin.email);

  const params = await searchParams;
  const today = todayInBangkok();
  const date = parseBookingDate(params.date);
  const roomId = parseBookingRoomId(params.room);

  return (
    <main className="page py-8 sm:py-10">
      <div className="max-w-2xl">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
          จองห้อง
        </h1>
        <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
          สวัสดี, {name} — เลือกห้อง เลือกวันที่ (วันนี้หรือวันพรุ่งนี้) และช่วงเวลา
          (ห้องทั่วไป/ละหมาด บล็อกละ 1 ชั่วโมง, ห้องประชุมใหญ่ บล็อกละ 2 ชั่วโมง)
          แล้วยืนยันเพื่อรับรหัส 6 หลักทางอีเมล
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

      <BookingFlow
        today={today}
        date={date}
        roomId={roomId}
        bookRoomAction={bookRoom}
      />

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
