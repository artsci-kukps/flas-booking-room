import BookingDayNav from "@/components/booking/booking-day-nav";
import RoomStatusSection from "@/components/booking/room-status-section";
import type { AdminBookingRow } from "@/lib/admin/booking-admin";
import type { BookRoomAction } from "@/lib/booking/booking-action";
import type { DayAvailability } from "@/lib/booking/day-availability";
import { formatThaiDate } from "@/lib/format";

import BookingCodeSearch, { type CodeSearchState } from "./booking-code-search";
import BookingsTable from "./bookings-table";

const BOOKING_MANAGEMENT_PATH = "/admin/booking-management";

type BookingManagementViewProps = {
  date: string;
  today: string;
  bookings: AdminBookingRow[];
  availability: DayAvailability;
  searchState: CodeSearchState;
  bookRoomAction: BookRoomAction;
};

/**
 * โครงหน้าศูนย์จัดการการจอง — แยกจาก page เพื่อให้เห็นภาพรวมและเทสต์ได้โดยไม่ต้องแตะ DB
 *
 * ลำดับตั้งใจให้ตรงกับงานที่แอดมินทำบ่อย:
 *   1. ค้นรหัสของวันนี้ → รับ–คืนกุญแจทันที
 *   2. เลือกวัน → ดูรายการจองที่ต้องดูแลก่อน
 *   3. ตารางห้องว่าง → ใช้เมื่อต้องจองห้องจากหน้านี้
 */
export default function BookingManagementView({
  date,
  today,
  bookings,
  availability,
  searchState,
  bookRoomAction,
}: BookingManagementViewProps) {
  return (
    <main className="page py-8 sm:py-10">
      <header className="max-w-3xl">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
          การจองและรับ–คืนกุญแจ
        </h1>
        <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
          ค้นรหัส 6 หลักเพื่อยืนยันรับ–คืนกุญแจของวันนี้ แล้วตรวจรายการจองและตารางห้องของวันที่เลือก
        </p>
      </header>

      <BookingCodeSearch date={date} today={today} state={searchState} />

      <BookingDayNav
        path={BOOKING_MANAGEMENT_PATH}
        date={date}
        today={today}
        className="mt-6"
      />

      {date !== today ? (
        <p className="mt-2 text-xs leading-relaxed text-ink-muted">
          ช่องค้นรหัสด้านบนใช้กับวันนี้เท่านั้น — รายการและตารางด้านล่างเป็นของวันที่เลือก
        </p>
      ) : null}

      <section className="mt-6" aria-labelledby="bookings-heading">
        <h2
          id="bookings-heading"
          className="text-base font-semibold tracking-tight text-ink"
        >
          รายการจองวันที่ {formatThaiDate(date)}
        </h2>
        <div className="mt-3">
          <BookingsTable rows={bookings} />
        </div>
      </section>

      <div className="mt-10">
        <RoomStatusSection
          date={date}
          today={today}
          availability={availability}
          bookRoomAction={bookRoomAction}
        />
      </div>
    </main>
  );
}
