import { Suspense } from "react";

import { requireUser } from "@/lib/auth/guards";
import { todayInBangkok } from "@/lib/admin/service-periods";
import { resolveBookableDate } from "@/lib/booking/booking-dates";

import AvailabilityPanel from "@/components/booking/availability-panel";
import BookingDatePicker from "@/components/booking/booking-date-picker";
import BookingRulesSection from "@/components/booking/booking-rules-section";
import MyBookingsSection from "@/components/booking/my-bookings-section";
import RoomTypesSection from "@/components/booking/room-types-section";
import ServiceHoursSection from "@/components/booking/service-hours-section";

/** ชื่อแสดงบนหัวหน้า: เอาชื่อจริง (โทเคนแรก) ถ้ามี ไม่งั้นใช้หน้าอีเมล */
function displayName(fullName: string | null, email: string): string {
  const name = fullName?.trim();
  if (name) return name.split(/\s+/)[0]!;
  return email.split("@")[0]!;
}

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const name = displayName(user.fullName, user.email);

  // ?date=YYYY-MM-DD กำหนดวันที่จอง — ค่าที่ไม่ถูกต้อง ผ่านมาแล้ว หรือเกินวันพรุ่งนี้
  // ถูกปรับกลับเป็นวันนี้เสมอ จึงจองได้เฉพาะวันนี้และวันพรุ่งนี้ (ticket T16-1)
  const today = todayInBangkok();
  const { date: rawDate } = await searchParams;
  const date = resolveBookableDate(rawDate, today);

  return (
    <main className="page py-8 sm:py-10">
      <div className="max-w-2xl">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
          จองห้อง
        </h1>
        <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
          สวัสดี, {name} — เลือกวันนี้หรือวันพรุ่งนี้ แล้วเลือกช่วงเวลาเป็นบล็อกละ 1
          ชั่วโมง ยืนยันเพื่อรับรหัส 6 หลักทางอีเมล
        </p>
      </div>

      <div className="mt-8">
        <BookingDatePicker
          basePath="/user/booking"
          today={today}
          selected={date}
        />
        <Suspense
          fallback={
            <div
              role="status"
              className="panel mt-4 p-10 text-center text-sm text-ink-muted"
            >
              กำลังโหลดตารางห้องเรียน…
            </div>
          }
        >
          <AvailabilityPanel date={date} />
        </Suspense>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
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
