import Link from "next/link";
import { Suspense } from "react";

import { listRooms } from "@/lib/admin/rooms";
import type { BookRoomAction } from "@/lib/booking/booking-action";
import { bookingDateOptions, isBookableBookingDate } from "@/lib/booking/booking-date";

import AvailabilityPanel from "./availability-panel";
import DayTabs from "./day-tabs";
import RoomDatePopup from "./room-date-popup";

/**
 * ขั้นตอนการจองที่ใช้ร่วมกันทั้งหน้าผู้ใช้และแอดมิน (ticket #17)
 * - ขั้น 1: ยังไม่เลือกห้อง/วัน → แสดงผนังป้ายห้อง + popup เลือกวัน (วันนี้/วันพรุ่งนี้)
 * - ขั้น 2: มี ?room= และ ?date= ที่ถูกต้อง → แสดงแท็บวัน + ช่องว่างของห้องนั้น
 *
 * วันที่เกินกว่าวันพรุ่งนี้หรือห้องที่ไม่รู้จักถือเป็นค่าไม่ถูกต้อง → กลับไปขั้น 1
 * ตัวเลือกวันคำนวณจาก todayInBangkok ฝั่ง server จึงจำกัดที่วันนี้/วันพรุ่งนี้เสมอ
 */

type BookingFlowProps = {
  /** ฐานเส้นทางของพื้นที่ เช่น '/user/booking' หรือ '/admin/booking' */
  basePath: string;
  /** วันนี้ในเขตเวลาไทย ('YYYY-MM-DD') */
  today: string;
  /** ค่าจาก ?date= (ยังไม่ผ่านการตรวจ) */
  date?: string | null;
  /** ค่าจาก ?room= (ยังไม่ผ่านการตรวจ) */
  roomId?: string | null;
  /** server action สำหรับยืนยันการจองของพื้นที่นี้ */
  bookRoomAction: BookRoomAction;
};

export default async function BookingFlow({
  basePath,
  today,
  date,
  roomId,
  bookRoomAction,
}: BookingFlowProps) {
  const rooms = await listRooms();
  const options = bookingDateOptions(today);

  const selectedRoom = roomId ? rooms.find((room) => room.id === roomId) : undefined;
  const activeDate =
    selectedRoom && date && isBookableBookingDate(date, today) ? date : null;

  if (!selectedRoom || !activeDate) {
    return (
      <RoomDatePopup
        basePath={basePath}
        dates={options}
        rooms={rooms.map((room) => ({
          id: room.id,
          name: room.name,
          roomTypeCode: room.roomTypeCode,
          roomTypeName: room.roomTypeName,
        }))}
      />
    );
  }

  return (
    <div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <DayTabs basePath={basePath} roomId={selectedRoom.id} options={options} active={activeDate} />
        <Link href={basePath} className="btn btn-outline btn-sm">
          เปลี่ยนห้อง
        </Link>
      </div>

      <Suspense
        fallback={
          <div role="status" className="panel mt-6 p-10 text-center text-sm text-ink-muted">
            กำลังโหลดตารางห้องเรียน…
          </div>
        }
      >
        <AvailabilityPanel
          date={activeDate}
          roomId={selectedRoom.id}
          bookRoomAction={bookRoomAction}
        />
      </Suspense>
    </div>
  );
}
