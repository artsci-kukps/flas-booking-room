import { listRooms } from "@/lib/admin/rooms";
import type { BookRoomAction } from "@/lib/booking/booking-action";
import { bookingDateOptions, isBookableBookingDate } from "@/lib/booking/booking-date";
import { getDayAvailability } from "@/lib/booking/day-availability";

import RoomDatePopup from "./room-date-popup";

/**
 * ขั้นตอนการจองที่ใช้ร่วมกันทั้งหน้าผู้ใช้และแอดมิน (ticket #17, #19)
 * ตอนนี้เหลือขั้นเดียว: ผนังป้ายห้อง + popup ที่ครอบการจองทั้งหมด
 * (เลือกวัน → เลือกบล็อกเวลา → ดูสรุป → ยืนยัน) ไม่มีหน้าขั้นที่สองแล้ว
 *
 * ความพร้อมของ "ทุกวันที่จองได้" (วันนี้/วันพรุ่งนี้) ถูกดึงที่ฝั่ง server ที่นี่
 * ด้วย getDayAvailability() จาก data layer เดิมโดยตรง แล้วส่งเป็น props เข้า popup —
 * สลับวันใน popup ได้ทันที ไม่มีการคำนวณ/ดึงข้อมูลช่องว่างซ้ำที่ client
 *
 * พารามิเตอร์ ?room= และ ?date= ที่ถูกต้อง (ห้องมีจริง วันอยู่ในหน้าต่างวันนี้/วันพรุ่งนี้)
 * จะเปิด popup พร้อมห้อง/วันนั้นทันที (ลิงก์ลึก) นอกนั้นถือเป็นค่าไม่ถูกต้อง → เริ่มจากผนังห้อง
 */

type BookingFlowProps = {
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
  today,
  date,
  roomId,
  bookRoomAction,
}: BookingFlowProps) {
  const options = bookingDateOptions(today);

  const [rooms, days] = await Promise.all([
    listRooms(),
    Promise.all(
      options.map(async (option) => ({
        option,
        availability: await getDayAvailability(option.date),
      })),
    ),
  ]);

  const selectedRoom = roomId ? rooms.find((room) => room.id === roomId) : undefined;
  const activeDate =
    selectedRoom && date && isBookableBookingDate(date, today) ? date : null;
  const initialRoom =
    selectedRoom && activeDate
      ? {
          id: selectedRoom.id,
          name: selectedRoom.name,
          roomTypeCode: selectedRoom.roomTypeCode,
          roomTypeName: selectedRoom.roomTypeName,
          minDurationMinutes: selectedRoom.minDurationMinutes,
        }
      : null;

  return (
    <RoomDatePopup
      rooms={rooms.map((room) => ({
        id: room.id,
        name: room.name,
        roomTypeCode: room.roomTypeCode,
        roomTypeName: room.roomTypeName,
        minDurationMinutes: room.minDurationMinutes,
      }))}
      days={days}
      bookRoomAction={bookRoomAction}
      initialRoom={initialRoom}
      initialDate={activeDate}
    />
  );
}
