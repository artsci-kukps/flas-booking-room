import { requireUser } from "@/lib/auth/guards";
import { todayInBangkok } from "@/lib/admin/service-periods";
import { parseBookingDate, parseBookingRoomId } from "@/lib/booking/booking-date";
import { BLOCK_LENGTH_COPY } from "@/lib/booking/slot-display";

import BookingFlow from "@/components/booking/booking-flow";
import MyBookingsSection from "@/components/booking/my-bookings-section";
import RoomTypesSection from "@/components/booking/room-types-section";
import ServiceHoursSection from "@/components/booking/service-hours-section";
import BookingRulesSection from "@/components/booking/booking-rules-section";

import { bookRoom } from "./actions";

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
          สวัสดี, {name} — เลือกห้อง เลือกวันที่ (วันนี้หรือวันพรุ่งนี้) และช่วงเวลา{" "}
          {BLOCK_LENGTH_COPY} แล้วยืนยันเพื่อรับรหัส 6 หลักทางอีเมล
        </p>
      </div>

      <BookingFlow
        today={today}
        date={date}
        roomId={roomId}
        bookRoomAction={bookRoom}
      />

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
