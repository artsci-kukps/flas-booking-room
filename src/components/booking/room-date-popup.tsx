"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import RoomTypeCodeBadge from "@/components/room-type-code-badge";
import { bookingRoomHref, type BookingDateOption } from "@/lib/booking/booking-date";

/**
 * ขั้นแรกของการจอง (ticket #17): เลือกห้อง แล้วเปิด popup ให้เลือกวันที่
 * ระหว่าง "วันนี้" หรือ "วันพรุ่งนี้" เท่านั้น จากนั้นจึงพาไปขั้นเลือกเวลา
 * ใช้ร่วมกันทั้งหน้าผู้ใช้และแอดมิน (basePath ต่างกัน)
 *
 * popup เป็น <dialog> แบบ modal — ได้การล็อกโฟกัส/ปิดด้วย Esc จากเบราว์เซอร์
 * ตัวเลือกวันมาจาก bookingDateOptions() ฝั่ง server จึงการันตีว่าไม่เกินวันพรุ่งนี้
 */

export type RoomDatePopupRoom = {
  id: string;
  name: string;
  roomTypeCode: string;
  roomTypeName: string;
};

type RoomDatePopupProps = {
  rooms: RoomDatePopupRoom[];
  /** ตัวเลือกวันที่จะแสดง — มีเพียงวันนี้และวันพรุ่งนี้เสมอ */
  dates: BookingDateOption[];
  /** ฐานเส้นทางของพื้นที่ เช่น '/user/booking' หรือ '/admin/booking' */
  basePath: string;
};

export default function RoomDatePopup({ rooms, dates, basePath }: RoomDatePopupProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [room, setRoom] = useState<RoomDatePopupRoom | null>(null);
  const [date, setDate] = useState<string>(dates[0]?.date ?? "");

  const open = (nextRoom: RoomDatePopupRoom) => {
    setRoom(nextRoom);
    setDate(dates[0]?.date ?? "");
    dialogRef.current?.showModal();
  };

  const close = () => {
    dialogRef.current?.close();
  };

  const confirm = () => {
    if (!room || !date) {
      return;
    }

    close();
    router.push(bookingRoomHref(basePath, room.id, date));
  };

  return (
    <section aria-labelledby="room-picker-heading" className="mt-6">
      <h2 id="room-picker-heading" className="text-base font-semibold tracking-tight text-ink">
        เลือกห้องที่ต้องการจอง
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        แตะห้องเพื่อเลือกวันที่จอง (วันนี้หรือวันพรุ่งนี้)
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
              {dates.map((option) => (
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

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={close} className="btn btn-outline">
              ยกเลิก
            </button>
            <button type="button" onClick={confirm} className="btn btn-primary">
              เลือกเวลา
            </button>
          </div>
        </div>
      </dialog>
    </section>
  );
}
