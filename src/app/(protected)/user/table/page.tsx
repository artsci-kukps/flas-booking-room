import { requireUser } from "@/lib/auth/guards";
import { todayInBangkok } from "@/lib/admin/service-periods";
import BookingDayNav from "@/components/booking/booking-day-nav";
import RoomTimeGrid from "@/components/booking/room-time-grid";
import { parseBookingDate } from "@/lib/booking/booking-date";
import { getDayAvailability } from "@/lib/booking/day-availability";
import { formatThaiDate } from "@/lib/format";

import { bookRoomFromTable } from "../booking/actions";

const PATH = "/user/table";

/**
 * ตารางจองภาพรวมของผู้ใช้ (ticket #20, spec #16) — ทุกห้องในหนึ่งวันเป็นตารางเดียว
 * แสดงสถานะช่วงเวลา (ว่าง/ไม่ว่าง/ถูกบล็อก/ผ่านไปแล้ว) ด้วยสี/ป้ายชุดเดียวกับหน้าจอง
 * และคลิกช่องว่างเพื่อเปิด popup จองพร้อมวันที่/เวลา/ห้องที่เลือกไว้ล่วงหน้า
 *
 * ความพร้อมของวันดึงฝั่ง server ด้วย getDayAvailability() — ตรรกะว่าง/เต็ม/บล็อก
 * และ CAPACITY/EXCLUSIVE จึงเป็นชุดเดียวกับหน้าจอง ไม่มีการคำนวณซ้ำที่ client
 *
 * ใช้ bookRoomFromTable (ไม่ redirect) เพราะผู้ใช้ต้องอยู่ที่หน้าตาราง
 * เพื่อเห็นช่องที่เพิ่งจองเปลี่ยนเป็น "ไม่ว่าง" ทันที (ticket #22)
 */
export default async function UserTablePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();

  const params = await searchParams;
  const today = todayInBangkok();
  const date = parseBookingDate(params.date) ?? today;
  const availability = await getDayAvailability(date);

  return (
    <main className="page py-8 sm:py-10">
      <div className="max-w-2xl">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
          ตารางจอง
        </h1>
        <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
          ภาพรวมการจองของทุกห้องในหนึ่งวัน — ดูว่าช่วงเวลาใดว่างหรือถูกจองไปแล้ว
          แล้วคลิกช่องว่างเพื่อจองผ่าน popup ได้ทันที
        </p>
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
