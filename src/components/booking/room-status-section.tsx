import type { BookRoomAction } from "@/lib/booking/booking-action";
import type { DayAvailability } from "@/lib/booking/day-availability";
import { formatThaiDate } from "@/lib/format";

import RoomTimeGrid from "./room-time-grid";

/**
 * ส่วน "ตารางสถานะห้อง × เวลา" ของหนึ่งวัน — ใช้ร่วมกันทุกหน้าที่แสดงตาราง
 * (หน้าตารางของผู้ใช้, หน้าตารางของแอดมิน และศูนย์กลางการจองของแอดมิน)
 * เพื่อไม่ให้แต่ละหน้าคัดลอกหัวข้อ/คำอธิบาย/การเรียกตารางแล้วคลาดเคลื่อนกัน
 *
 * ความพร้อมของวัน (availability) ดึงมาฝั่ง server ด้วย getDayAvailability()
 * และส่งเข้าไปเป็น prop เหมือนกันทุกหน้า
 */

type RoomStatusSectionProps = {
  /** วันของตาราง ('YYYY-MM-DD') */
  date: string;
  /** วันปัจจุบันในเขตเวลาไทย — ใช้ตัดสินว่าวันนี้รับจองผ่านตารางได้หรือไม่ */
  today: string;
  /** ความพร้อมของวันนั้นที่ดึงไว้ฝั่ง server */
  availability: DayAvailability;
  /** server action ยืนยันการจองของพื้นที่ (ผู้ใช้/แอดมินส่งของตัวเองเข้ามา) */
  bookRoomAction: BookRoomAction;
};

export default function RoomStatusSection({
  date,
  today,
  availability,
  bookRoomAction,
}: RoomStatusSectionProps) {
  // สรุปสั้น ๆ ให้รู้ก่อนไล่อ่านตารางว่าวันนี้มีห้องไหนว่างบ้าง
  const freeRooms = availability.open
    ? availability.rooms.filter((room) =>
        room.slots.some((slot) => slot.selectable),
      ).length
    : 0;

  return (
    <section className="mt-6" aria-labelledby="room-grid-heading">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <h2
            id="room-grid-heading"
            className="text-lg font-semibold tracking-tight text-ink"
          >
            ตารางสถานะห้องวันที่ {formatThaiDate(date)}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            สถานะช่วงเวลาของทุกห้องในวันเดียว — ว่าง ไม่ว่าง ถูกบล็อก หรือผ่านไปแล้ว
          </p>
        </div>

        {availability.open ? (
          <p className="text-xs font-semibold text-ink-muted">
            มีช่วงว่าง{" "}
            <span className="tabular-nums text-ink">
              {freeRooms}/{availability.rooms.length}
            </span>{" "}
            ห้อง
          </p>
        ) : null}
      </div>

      <RoomTimeGrid
        date={date}
        today={today}
        availability={availability}
        bookRoomAction={bookRoomAction}
      />
    </section>
  );
}
