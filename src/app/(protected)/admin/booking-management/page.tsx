import {
  findBookingByCodeOnDay,
  isBookingCode,
  listBookingsForDay,
} from "@/lib/admin/booking-admin";
import { todayInBangkok } from "@/lib/admin/service-periods";
import { requireAdmin } from "@/lib/auth/guards";
import { parseBookingDate } from "@/lib/booking/day-availability";
import { formatThaiDate } from "@/lib/format";

import BookingCodeSearch, { type CodeSearchState } from "./booking-code-search";
import BookingDayNav from "./booking-day-nav";
import BookingsTable from "./bookings-table";

/** อ่านพารามิเตอร์ query ที่อาจเป็นอาร์เรย์ ให้เป็นสตริงเดียวที่ trim แล้ว */
function readParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();

  return trimmed ? trimmed : null;
}

/**
 * ศูนย์กลางการจองของแอดมิน (ticket #11)
 * - ตารางการจองตามวันและห้อง พร้อมปุ่มยืนยันรับ–คืนกุญแจ
 * - ค้นรหัส 6 หลัก จำกัดขอบเขตที่วันปัจจุบันเท่านั้น (TOR ข้อ 6.3)
 * (?date= เลือกวันของตาราง ส่วน ?code= ค้นของ "วันนี้" เสมอ)
 */
export default async function BookingManagementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const today = todayInBangkok();
  const date = parseBookingDate(params.date) ?? today;
  const code = readParam(params.code);

  const [bookings, found] = await Promise.all([
    listBookingsForDay(date),
    code && isBookingCode(code)
      ? findBookingByCodeOnDay(code, today)
      : Promise.resolve(null),
  ]);

  let searchState: CodeSearchState = { kind: "idle" };

  if (code) {
    if (!isBookingCode(code)) {
      searchState = { kind: "invalid" };
    } else if (found) {
      searchState = { kind: "found", booking: found };
    } else {
      searchState = { kind: "not-found", code };
    }
  }

  return (
    <main className="page py-8 sm:py-10">
      <div className="max-w-2xl">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
          การจองและรับ–คืนกุญแจ
        </h1>
        <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
          ตารางการจองทุกห้องของวันที่เลือก — ยืนยันรับกุญแจเมื่อผู้ใช้แจ้งรหัส 6 หลัก
          และยืนยันคืนกุญแจเมื่อใช้ห้องเสร็จ
        </p>
      </div>

      <BookingCodeSearch date={date} today={today} state={searchState} />
      <BookingDayNav date={date} today={today} />

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
    </main>
  );
}
