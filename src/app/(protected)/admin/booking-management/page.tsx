import {
  findBookingByCodeOnDay,
  isBookingCode,
  listBookingsForDay,
} from "@/lib/admin/booking-admin";
import { todayInBangkok } from "@/lib/admin/service-periods";
import { requireAdmin } from "@/lib/auth/guards";
import { getDayAvailability } from "@/lib/booking/day-availability";
import { parseBookingDate } from "@/lib/booking/booking-date";

import { bookRoomFromTable } from "../booking/actions";
import type { CodeSearchState } from "./booking-code-search";
import BookingManagementView from "./booking-management-view";

/** อ่านพารามิเตอร์ query ที่อาจเป็นอาร์เรย์ ให้เป็นสตริงเดียวที่ trim แล้ว */
function readParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();

  return trimmed ? trimmed : null;
}

/**
 * ศูนย์กลางการจองของแอดมิน (ticket #11, #20)
 * - ค้นรหัส 6 หลักของวันนี้ เพื่อยืนยันรับ–คืนกุญแจ (TOR ข้อ 6.3)
 * - ตารางรายการจองของวันที่เลือก พร้อมปุ่มรับ–คืนกุญแจ
 * - ตารางสถานะห้อง × เวลา — คลิกช่องว่างเพื่อจองได้ทันที (popup พร้อมข้อมูลล่วงหน้า)
 *
 * (?date= เลือกวันของรายการ/ตาราง ส่วน ?code= ค้นของ "วันนี้" เสมอ)
 *
 * ตารางใช้ bookRoomFromTable (ไม่พาไปหน้ายืนยัน) เพราะแอดมินต้องอยู่ที่หน้านี้
 * เพื่อเห็นช่องที่เพิ่งจองเปลี่ยนเป็น "ไม่ว่าง" ทันที (ticket #22)
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

  const [bookings, availability, found] = await Promise.all([
    listBookingsForDay(date),
    getDayAvailability(date),
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
    <BookingManagementView
      date={date}
      today={today}
      bookings={bookings}
      availability={availability}
      searchState={searchState}
      bookRoomAction={bookRoomFromTable}
    />
  );
}
