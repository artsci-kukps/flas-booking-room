"use client";

import { useEffect, useRef, useState } from "react";

import RoomTypeCodeBadge from "@/components/room-type-code-badge";
import type { BookingDateOption } from "@/lib/booking/booking-date";
import { dayClosedMessage } from "@/lib/booking/day-closed";
import type { DayAvailability, RoomDayAvailability } from "@/lib/booking/day-availability";
import { slotLengthLabel } from "@/lib/booking/slot-display";

import type { BookRoomAction } from "@/lib/booking/booking-action";

import SlotPicker from "./slot-picker";

/**
 * ขั้นตอนการจองทั้งหมดใน popup เดียว (ticket #19, spec #16):
 * ผนังป้ายห้อง → แตะห้องเพื่อเปิด <dialog> → เลือกวัน (วันนี้/วันพรุ่งนี้)
 * → เลือกบล็อกเวลาของห้องนั้น → ดูสรุป (ห้อง/ประเภท/วันที่/บล็อก) → ยืนยันใน popup เลย
 * ไม่ต้องพาไปหน้าขั้นที่สองแล้ว
 *
 * popup เป็น <dialog> แบบ modal — ได้การล็อกโฟกัส/ปิดด้วย Esc จากเบราว์เซอร์
 * ความพร้อมของแต่ละวัน (ช่องว่าง/วันปิด) ถูกดึงฝั่ง server ใน BookingFlow ส่งเข้ามาเป็น props
 * จึงสลับวันได้ทันทีไม่ต้องยิงคำขอใหม่ และไม่มีตรรกะช่องว่างซ้ำฝั่ง client
 *
 * ลิงก์ลึก ?room=&date= (ที่ผ่านการตรวจใน BookingFlow) จะเปิด popup พร้อมห้อง/วันนั้นทันที
 */

export type RoomDatePopupRoom = {
  id: string;
  name: string;
  roomTypeCode: string;
  roomTypeName: string;
  /** ระยะเวลาขั้นต่ำของประเภทห้อง — เป็นความยาวบล็อกเวลาใน popup (S/P = 1 ชม., G = 2 ชม.) */
  minDurationMinutes: number;
};

/** หนึ่งวันที่จองได้ พร้อมความพร้อมที่ดึงไว้ฝั่ง server */
export type BookingDay = {
  option: BookingDateOption;
  availability: DayAvailability;
};

type RoomDatePopupProps = {
  rooms: RoomDatePopupRoom[];
  /** ความพร้อมของทุกวันที่จองได้ (วันนี้/วันพรุ่งนี้) เรียงตาม `option.date` */
  days: BookingDay[];
  /** server action ยืนยันการจองของพื้นที่นี้ (user/admin ส่งของตัวเองเข้ามา) */
  bookRoomAction: BookRoomAction;
  /** ?room= ที่ถูกต้อง — เปิด popup พร้อมห้องนี้ทันที (ลิงก์ลึก) */
  initialRoom?: RoomDatePopupRoom | null;
  /** ?date= ที่ถูกต้อง — วันเริ่มต้นเมื่อเปิดจากลิงก์ลึก */
  initialDate?: string | null;
};

export default function RoomDatePopup({
  rooms,
  days,
  bookRoomAction,
  initialRoom = null,
  initialDate = null,
}: RoomDatePopupProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [room, setRoom] = useState<RoomDatePopupRoom | null>(initialRoom);
  const [date, setDate] = useState<string>(initialDate ?? days[0]?.option.date ?? "");

  // ลิงก์ลึก ?room=&date=: ยก dialog เป็นแบบ modal ทันทีที่โหลด (ได้ focus trap/Esc ครบ)
  useEffect(() => {
    const dialog = dialogRef.current;

    if (initialRoom && dialog && !dialog.open) {
      dialog.showModal();
    }
  }, [initialRoom]);

  const open = (nextRoom: RoomDatePopupRoom) => {
    setRoom(nextRoom);
    setDate(days[0]?.option.date ?? "");

    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  };

  const close = () => {
    dialogRef.current?.close();
  };

  const day = days.find((item) => item.option.date === date) ?? null;
  const availability = day?.availability ?? null;
  /** หน้าต่างเวลาทำการของวันที่เลือกเมื่อวันเปิด (ใช้แสดงเวลาเปิด–ปิด + ช่องว่าง) */
  const openDay = room !== null && availability !== null && availability.open
    ? availability
    : null;
  const dayRoom: RoomDayAvailability | null =
    openDay !== null && room !== null
      ? (openDay.rooms.find((item) => item.id === room.id) ?? null)
      : null;
  /** แสดงตารางช่องว่าง + ฟอร์มยืนยันใน popup หรือแสดงข้อความวันปิด/ไม่พบห้องแทน */
  const showPicker = room !== null && openDay !== null && dayRoom !== null;

  const cancelButton = (
    <button type="button" onClick={close} className="btn btn-outline">
      ยกเลิก
    </button>
  );

  return (
    <section aria-labelledby="room-picker-heading" className="mt-6">
      <h2 id="room-picker-heading" className="text-base font-semibold tracking-tight text-ink">
        เลือกห้องที่ต้องการจอง
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        แตะห้องเพื่อเปิด popup จอง — เลือกวันที่ (วันนี้หรือวันพรุ่งนี้) และช่วงเวลา
        แล้วยืนยันได้ในนั้นเลย
      </p>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => open(item)}
              data-room-id={item.id}
              className="panel flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-canvas"
            >
              <RoomTypeCodeBadge code={item.roomTypeCode} />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold tracking-tight text-ink">
                  {item.name}
                </span>
                <span className="mt-0.5 block text-sm text-ink-muted">
                  {item.roomTypeName}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {rooms.length === 0 ? (
        <p className="panel mt-4 p-6 text-sm text-ink-muted">ยังไม่มีห้องที่เปิดให้จอง</p>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-labelledby="room-date-popup-title"
        className="modal"
        onClose={() => setRoom(null)}
      >
        <div className="step-forward">
          <div className="flex items-start gap-3">
            {room ? <RoomTypeCodeBadge code={room.roomTypeCode} /> : null}
            <div className="min-w-0 flex-1">
              <h2
                id="room-date-popup-title"
                className="text-base font-semibold tracking-tight text-ink"
              >
                {room ? room.name : "เลือกวันที่จอง"}
              </h2>
              <p className="mt-0.5 text-sm text-ink-muted">
                {room ? room.roomTypeName : "วันนี้หรือวันพรุ่งนี้เท่านั้น"}
              </p>
            </div>
          </div>

          <fieldset className="mt-5">
            <legend className="text-xs font-semibold text-ink-muted">เลือกวันที่จอง</legend>
            <div className="mt-2 grid gap-2">
              {days.map(({ option }) => (
                <label
                  key={option.date}
                  className={`flex cursor-pointer items-center gap-3 rounded-[12px] border p-3 transition-colors ${
                    date === option.date
                      ? "border-ku bg-ku-soft"
                      : "border-border bg-surface hover:bg-canvas"
                  }`}
                >
                  <input
                    type="radio"
                    name="booking-date"
                    value={option.date}
                    checked={date === option.date}
                    onChange={() => setDate(option.date)}
                    className="h-4 w-4 accent-ku"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{option.label}</span>
                    <span className="mt-0.5 block text-sm tabular-nums text-ink-muted">
                      {option.weekday} · {option.formatted}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {room && openDay && dayRoom ? (
            <div className="mt-5">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs font-semibold text-ink-muted">
                <span>
                  เวลาเปิด–ปิด:{" "}
                  <span className="tabular-nums">
                    {openDay.openTime}–{openDay.closeTime}
                  </span>
                </span>
                <span>บล็อกละ {slotLengthLabel(room.minDurationMinutes)}</span>
              </div>

              <div className="mt-3">
                {/* key เปลี่ยนเมื่อสลับห้อง/วัน → เลือกช่องเริ่มใหม่เสมอ ไม่เอาบล็อกของวันก่อนไปปน */}
                <SlotPicker
                  key={`${room.id}-${date}`}
                  date={date}
                  room={dayRoom}
                  bookRoomAction={bookRoomAction}
                  secondaryAction={cancelButton}
                />
              </div>
            </div>
          ) : room && availability && !availability.open ? (
            <p className="panel mt-5 p-4 text-sm leading-relaxed text-ink-muted">
              {dayClosedMessage(availability)}
            </p>
          ) : room && availability ? (
            <p className="mt-5 text-sm text-ink-muted">
              ไม่พบห้องนี้สำหรับวันที่เลือก — ลองเลือกห้องอื่นจากผนังห้อง
            </p>
          ) : null}

          {/* ปุ่มยกเลิกอยู่ในฟอร์มของช่องว่างเมื่อแสดงช่องว่าง — มิฉะนั้นเป็นแถวปุ่มท้าย popup */}
          {showPicker ? null : (
            <div className="mt-5 flex flex-wrap justify-end gap-2">{cancelButton}</div>
          )}
        </div>
      </dialog>
    </section>
  );
}
