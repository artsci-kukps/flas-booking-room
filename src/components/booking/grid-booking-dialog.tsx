"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import RoomTypeCodeBadge from "@/components/room-type-code-badge";
import type { BookRoomAction } from "@/lib/booking/booking-action";
import type { RoomDayAvailability, RoomSlotView } from "@/lib/booking/day-availability";
import { slotLengthLabel } from "@/lib/booking/slot-display";
import { formatThaiDate } from "@/lib/format";

import SlotPicker from "./slot-picker";

/**
 * popup จองที่เปิดจากคลิกช่องว่างในตารางห้อง (ticket #20, spec #16)
 * ข้อมูลวันที่/เวลา/ห้อง ถูกส่งมาพร้อมเปิด — บล็อกที่คลิกถูกเลือกไว้ใน SlotPicker แล้ว
 * ผู้ใช้เพิ่มบล็อกอื่นของห้องเดียวกัน หรือกดยืนยันได้ทันที
 *
 * ยืนยันผ่าน bookRoom action ของพื้นที่เดียวกับหน้าจอง (user/admin ส่งของตัวเองเข้ามา)
 * จึงไม่มีตรรกะ CAPACITY/EXCLUSIVE ซ้ำฝั่ง client — server ตรวจเหมือนเดิมทุกประการ
 *
 * เป็น <dialog> แบบ modal: ได้โฟกัส/Esc จากเบราว์เซอร์ และ mount ครั้งเดียวต่อการคลิกหนึ่งครั้ง
 * (ผู้ปกครอง key ด้วย ห้อง+ช่อง ทำให้ initialSlot ถูกอ่านแค่ตอนเปิด)
 *
 * หลังจองจบ (สำเร็จหรือไม่สำเร็จ) จะสั่ง router.refresh() ให้ตารางห้อง×เวลาดึงข้อมูลล่าสุด
 * ช่องที่เพิ่งจองจึงเปลี่ยนเป็น "ไม่ว่าง" ทันทีโดยผู้ใช้ยังอยู่ที่หน้าตาราง (ticket #22)
 */

type GridBookingDialogProps = {
  /** 'YYYY-MM-DD' — วันของตารางที่ผู้ใช้คลิก */
  date: string;
  /** ห้องของช่องที่คลิก พร้อมช่องว่างของวันนั้น */
  room: RoomDayAvailability;
  /** ช่องว่างที่ผู้ใช้คลิกในตาราง — ถูกเลือกไว้ล่วงหน้าใน picker */
  slot: RoomSlotView;
  /** เวลาเปิด–ปิดของวันนั้น (แสดงเหนือ picker) */
  openTime: string;
  closeTime: string;
  /** server action ยืนยันการจองของพื้นที่ (user/admin) */
  bookRoomAction: BookRoomAction;
  /** เรียกเมื่อ popup ปิด (ปุ่มยกเลิก/Esc) — ผู้ปกครองล้างเป้าหมายการจอง */
  onClose: () => void;
};

export default function GridBookingDialog({
  date,
  room,
  slot,
  openTime,
  closeTime,
  bookRoomAction,
  onClose,
}: GridBookingDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  // เปิดเป็น modal ทันทีที่ mount (ได้ focus trap + ปิดด้วย Esc ครบ)
  useEffect(() => {
    const dialog = dialogRef.current;

    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  const close = () => dialogRef.current?.close();

  // รีเฟรชหลังจองจบ — ไม่ว่าสำเร็จหรือไม่สำเร็จ ตารางต้องเห็นสถานะล่าสุดของช่องที่เพิ่งแตะ
  // (กรณีไม่สำเร็จมักคือ "มีคนจองไปแล้ว" ตารางจะได้เปลี่ยนช่องนั้นเป็น "ไม่ว่าง" ด้วย)
  const handleResult = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="grid-booking-title"
      className="modal"
      onClose={onClose}
    >
      <div className="step-forward">
        <div className="flex items-start gap-3">
          <RoomTypeCodeBadge code={room.roomTypeCode} />
          <div className="min-w-0 flex-1">
            <h2 id="grid-booking-title" className="text-lg font-semibold tracking-tight text-ink">
              {room.name}
            </h2>
            <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">
              {room.roomTypeName} · {formatThaiDate(date)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
          <span>
            เปิด{" "}
            <span className="tabular-nums">
              {openTime}–{closeTime}
            </span>
          </span>
          <span>บล็อกละ {slotLengthLabel(room.minDurationMinutes)}</span>
        </div>

        <div className="mt-5">
          {/* key เปลี่ยนตามห้อง/วัน — เลือกช่องเริ่มใหม่เสมอเมื่อเปิด popup ครั้งถัดไป */}
          <SlotPicker
            key={`${room.id}-${date}`}
            date={date}
            room={room}
            bookRoomAction={bookRoomAction}
            initialSlot={slot.start}
            onResult={handleResult}
            secondaryAction={
              <button type="button" onClick={close} className="btn btn-ghost">
                ยกเลิก
              </button>
            }
          />
        </div>
      </div>
    </dialog>
  );
}
