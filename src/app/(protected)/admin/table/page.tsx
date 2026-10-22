import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { todayInBangkok } from "@/lib/admin/service-periods";
import BookingDayNav from "@/components/booking/booking-day-nav";
import RoomTimeGrid from "@/components/booking/room-time-grid";
import { parseBookingDate } from "@/lib/booking/booking-date";
import { getDayAvailability } from "@/lib/booking/day-availability";
import { formatThaiDate } from "@/lib/format";

import { bookRoomFromTable } from "../booking/actions";

export const metadata: Metadata = {
  title: "ตารางจอง",
};

const PATH = "/admin/table";
const BOOKING_MANAGEMENT_PATH = "/admin/booking-management";

/**
 * ตารางจองภาพรวมของแอดมิน (ticket #20, spec #16) — หน้าเดียวกับตารางของผู้ใช้
 * แต่ตรวจสิทธิ์แอดมิน และเพิ่มทางเข้า "จัดการการจอง" เพราะดูได้ทั้งวันจากหน้านี้
 * ความพร้อมของวันดึงด้วย getDayAvailability() ชุดเดียวกับหน้าจอง
 * (CAPACITY/EXCLUSIVE ไม่คำนวณซ้ำที่ client)
 *
 * ใช้ bookRoomFromTable (ไม่ redirect) เพราะแอดมินต้องอยู่ที่หน้าตาราง
 * เพื่อเห็นช่องที่เพิ่งจองเปลี่ยนเป็น "ไม่ว่าง" ทันที (ticket #22)
 */
export default async function AdminTablePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const today = todayInBangkok();
  const date = parseBookingDate(params.date) ?? today;
  const availability = await getDayAvailability(date);

  return (
    <main className="page py-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
            ตารางจอง
          </h1>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
            ภาพรวมการจองของทุกห้องในหนึ่งวัน — ดูว่าช่วงเวลาใดว่างหรือถูกจองไปแล้ว
            แล้วคลิกช่องว่างเพื่อจองผ่าน popup ได้ทันที
          </p>
        </div>
        <a
          href={BOOKING_MANAGEMENT_PATH}
          className="btn btn-outline btn-sm"
        >
          จัดการการจอง
        </a>
      </div>

      <BookingDayNav path={PATH} date={date} today={today} />

      <section className="mt-6" aria-labelledby="room-grid-heading">
        <h2
          id="room-grid-heading"
          className="text-base font-semibold tracking-tight text-ink"
        >
          ตารางสถานะห้องวันที่ {formatThaiDate(date)}
        </h2>
        <RoomTimeGrid
          date={date}
          today={today}
          availability={availability}
          bookRoomAction={bookRoomFromTable}
        />
      </section>
    </main>
  );
}
