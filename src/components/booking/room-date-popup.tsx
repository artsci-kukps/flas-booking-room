"use client";

import { useEffect, useRef, useState } from "react";

import RoomTypeCodeBadge from "@/components/room-type-code-badge";
import type { BookingDateOption } from "@/lib/booking/booking-date";
import { dayClosedMessage } from "@/lib/booking/day-closed";
import type {
  DayAvailability,
  RoomDayAvailability,
  RoomSlotView,
} from "@/lib/booking/day-availability";
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
 * ผนังห้องบอกสถานะย่อของวันแรกที่เปิดให้จอง (วันนี้ หรือพรุ่งนี้ถ้าวันนี้ปิด)
 * พร้อมแท่งช่วงเวลาเล็ก ๆ ให้เห็นว่าห้องไหนว่างบ้างโดยไม่ต้องเปิด popup
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

/** สถานะย่อของห้องบนผนัง — อ่านจากวันแรกที่เปิดให้จอง */
type PlateStatus = {
  label: string;
  /** true = ยังมีช่วงว่าง (โทน KU), false = เต็ม/ปิด (โทนเงียบ) */
  free: boolean;
  slots: RoomDayAvailability["slots"];
};

function plateStatus(roomId: string, day: BookingDay | null): PlateStatus {
  if (!day) {
    return { label: "ไม่มีข้อมูล", free: false, slots: [] };
  }

  if (!day.availability.open) {
    return { label: "ปิดทำการ", free: false, slots: [] };
  }

  const roomDay = day.availability.rooms.find((room) => room.id === roomId);

  if (!roomDay) {
    return { label: "ไม่เปิดให้จอง", free: false, slots: [] };
  }

  if (roomDay.slots.length === 0) {
    return { label: "ไม่มีช่วงเวลา", free: false, slots: [] };
  }

  const free = roomDay.slots.filter((slot) => slot.selectable).length;

  return free > 0
    ? { label: `ว่าง ${free} ช่วง`, free: true, slots: roomDay.slots }
    : { label: "ไม่ว่าง", free: false, slots: roomDay.slots };
}

/** แท่งช่วงเวลาท้ายป้ายห้อง — เขียว = เลือกได้, amber = ถูกจองเต็ม, เทา = ผ่านไป/ถูกบล็อก */
function slotTickClass(slot: RoomSlotView): string {
  if (slot.selectable) return "bg-ku/70";
  if (slot.status === "occupied") return "bg-amber/60";
  return "bg-border";
}

type RoomTypeGroup = {
  code: string;
  name: string;
  rooms: RoomDatePopupRoom[];
};

/** ลำดับประเภทห้องตาม TOR — ห้องทั่วไป → ห้องประชุมใหญ่ → ห้องละหมาด แล้วจึงรหัสอื่น */
const ROOM_TYPE_ORDER = ["S", "G", "P"];

/** จัดห้องบนผนังเป็นกลุ่มตามประเภท โดยคงลำดับห้องเดิมภายในกลุ่ม */
function groupRoomsByType(rooms: RoomDatePopupRoom[]): RoomTypeGroup[] {
  const groups = new Map<string, RoomTypeGroup>();

  for (const room of rooms) {
    const group = groups.get(room.roomTypeCode);

    if (group) {
      group.rooms.push(room);
    } else {
      groups.set(room.roomTypeCode, {
        code: room.roomTypeCode,
        name: room.roomTypeName,
        rooms: [room],
      });
    }
  }

  const rank = (code: string) => {
    const index = ROOM_TYPE_ORDER.indexOf(code);
    return index === -1 ? ROOM_TYPE_ORDER.length : index;
  };

  return [...groups.values()].sort(
    (a, b) => rank(a.code) - rank(b.code) || a.code.localeCompare(b.code),
  );
}

export default function RoomDatePopup({
  rooms,
  days,
  bookRoomAction,
  initialRoom = null,
  initialDate = null,
}: RoomDatePopupProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  /** วันที่เปิดให้จองวันแรก — ใช้ทั้งสถานะบนผนังห้องและวันเริ่มต้นของ popup */
  const firstOpenDate =
    days.find((day) => day.availability.open)?.option.date ??
    days[0]?.option.date ??
    "";

  const [room, setRoom] = useState<RoomDatePopupRoom | null>(initialRoom);
  const [date, setDate] = useState<string>(initialDate ?? firstOpenDate);

  // ลิงก์ลึก ?room=&date=: ยก dialog เป็นแบบ modal ทันทีที่โหลด (ได้ focus trap/Esc ครบ)
  useEffect(() => {
    const dialog = dialogRef.current;

    if (initialRoom && dialog && !dialog.open) {
      dialog.showModal();
    }
  }, [initialRoom]);

  const open = (nextRoom: RoomDatePopupRoom) => {
    setRoom(nextRoom);
    setDate(firstOpenDate);

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
  const openAvailability =
    room !== null && availability !== null && availability.open
      ? availability
      : null;
  const dayRoom: RoomDayAvailability | null =
    openAvailability !== null && room !== null
      ? (openAvailability.rooms.find((item) => item.id === room.id) ?? null)
      : null;
  /** แสดงตารางช่องว่าง + ฟอร์มยืนยันใน popup หรือแสดงข้อความวันปิด/ไม่พบห้องแทน */
  const showPicker = room !== null && openAvailability !== null && dayRoom !== null;

  /** วันที่ใช้สรุปสถานะบนผนัง — วันนี้ถ้าเปิด ไม่งั้นวันแรกที่เปิด */
  const statusDay =
    days.find((item) => item.availability.open) ?? days[0] ?? null;

  const cancelButton = (
    <button type="button" onClick={close} className="btn btn-ghost">
      ยกเลิก
    </button>
  );

  const roomGroups = groupRoomsByType(rooms);

  return (
    <section aria-labelledby="room-picker-heading" className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h2
            id="room-picker-heading"
            className="text-base font-semibold tracking-tight text-ink"
          >
            เลือกห้อง
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            แตะการ์ดห้องเพื่อเลือกวันและช่วงเวลา
          </p>
        </div>

        {statusDay ? (
          <p className="text-xs font-semibold text-ink-muted">
            สถานะ{statusDay.option.label} ·{" "}
            <span className="tabular-nums">{statusDay.option.formatted}</span>
          </p>
        ) : null}
      </div>

      <div className="mt-5 space-y-8">
        {roomGroups.map((group) => (
          <section
            key={group.code}
            aria-labelledby={`room-type-${group.code}`}
            data-room-type-group={group.code}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3
                id={`room-type-${group.code}`}
                className="text-sm font-semibold tracking-tight text-ink"
              >
                {group.name}
              </h3>
              <span className="text-xs tabular-nums text-ink-muted">
                {`${group.rooms.length} ห้อง`}
              </span>
            </div>

            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.rooms.map((item) => {
                const status = plateStatus(item.id, statusDay);

                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => open(item)}
                      data-room-id={item.id}
                      className="panel group flex h-full w-full flex-col p-4 text-left transition-colors hover:bg-canvas"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <RoomTypeCodeBadge code={item.roomTypeCode} />
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-semibold ${
                            status.free
                              ? "bg-ku-soft text-ku"
                              : "border border-border bg-canvas text-ink-muted"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className="h-1.5 w-1.5 rounded-full bg-current"
                          />
                          {status.label}
                        </span>
                      </span>

                      <span className="mt-3 block text-[1.375rem] font-semibold tabular-nums tracking-tight text-ink">
                        {item.name}
                      </span>
                      <span className="mt-0.5 block text-[0.8125rem] text-ink-muted">
                        {item.roomTypeName} · ขั้นต่ำ{" "}
                        {slotLengthLabel(item.minDurationMinutes)}
                      </span>

                      <span className="mt-auto flex items-center gap-3 pt-4">
                        <span
                          aria-hidden="true"
                          className="flex h-1 flex-1 items-stretch gap-1"
                        >
                          {status.slots.length > 0 ? (
                            status.slots.map((slot) => (
                              <span
                                key={slot.start}
                                className={`flex-1 rounded-full ${slotTickClass(slot)}`}
                              />
                            ))
                          ) : (
                            <span className="h-1 flex-1 rounded-full bg-border" />
                          )}
                        </span>
                        <span
                          aria-hidden="true"
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-ink-muted transition-colors group-hover:border-ku group-hover:text-ku"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-3.5 w-3.5"
                          >
                            <path d="m9 6 6 6-6 6" />
                          </svg>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {rooms.length === 0 ? (
        <div className="panel mt-4 p-10 text-center">
          <span
            aria-hidden="true"
            className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-ku-soft text-ku"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M6 20V7a6 6 0 0 1 12 0v13" />
              <path d="M4 20h16" />
              <circle cx="12" cy="11" r="1.4" />
              <path d="M12 12.4v2.6" />
            </svg>
          </span>
          <p className="mt-3 font-semibold text-ink">ยังไม่มีห้องที่เปิดให้จอง</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            เมื่อแอดมินเปิดห้อง ห้องทั้งหมดจะแสดงที่นี่พร้อมช่วงเวลาว่าง
          </p>
        </div>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-labelledby="room-date-popup-title"
        className="modal"
        onClose={() => setRoom(null)}
      >
        <div className="step-forward">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              {room ? <RoomTypeCodeBadge code={room.roomTypeCode} /> : null}
              <div className="min-w-0">
                <h2
                  id="room-date-popup-title"
                  className="text-lg font-semibold tracking-tight text-ink"
                >
                  {room ? room.name : "เลือกวันที่จอง"}
                </h2>
                {/* รวมข้อมูลประกอบ (ประเภท/เวลาเปิด–ปิด/ความยาวบล็อก) ไว้บรรทัดเดียว
                    ไม่ต้องมีแถบข้อมูลอีกชั้นในตัว popup */}
                <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">
                  {room ? (
                    <>
                      {room.roomTypeName}
                      {openAvailability ? (
                        <>
                          {" · เปิด "}
                          <span className="tabular-nums">
                            {openAvailability.openTime}–
                            {openAvailability.closeTime}
                          </span>
                          {" · บล็อกละ "}
                          {slotLengthLabel(room.minDurationMinutes)}
                        </>
                      ) : null}
                    </>
                  ) : (
                    "วันนี้หรือวันพรุ่งนี้เท่านั้น"
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={close}
              className="icon-btn -mr-2 -mt-2 shrink-0"
              aria-label="ปิดหน้าต่างจอง"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="m6 6 12 12" />
                <path d="m18 6-12 12" />
              </svg>
            </button>
          </div>

          <fieldset className="mt-5">
            <legend className="text-xs font-semibold text-ink-muted">
              เลือกวันที่จอง
            </legend>
            {/* ตัวเลือกวันแบบรางเดียว: พื้นเทารางเดียว ไม่มีขอบรอบละตัวเลือก */}
            <div className="mt-2 grid grid-cols-2 gap-1 rounded-[12px] bg-canvas p-1">
              {days.map(({ option }) => {
                const active = date === option.date;

                return (
                  <label
                    key={option.date}
                    className={`cursor-pointer rounded-[9px] px-3 py-2 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ku ${
                      active ? "bg-surface" : "hover:bg-surface/60"
                    }`}
                  >
                    <input
                      type="radio"
                      name="booking-date"
                      value={option.date}
                      checked={active}
                      onChange={() => setDate(option.date)}
                      className="sr-only"
                    />
                    <span
                      className={`block text-sm font-semibold ${active ? "text-ku" : "text-ink"}`}
                    >
                      {option.label}
                    </span>
                    <span
                      className={`mt-0.5 block text-[0.75rem] tabular-nums ${active ? "text-ku" : "text-ink-muted"}`}
                    >
                      {option.weekday} · {option.formatted}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {room && openAvailability && dayRoom ? (
            <div className="mt-5">
              {/* key เปลี่ยนเมื่อสลับห้อง/วัน → เลือกช่องเริ่มใหม่เสมอ ไม่เอาบล็อกของวันก่อนไปปน */}
              <SlotPicker
                key={`${room.id}-${date}`}
                date={date}
                room={dayRoom}
                bookRoomAction={bookRoomAction}
                secondaryAction={cancelButton}
              />
            </div>
          ) : room && availability && !availability.open ? (
            <p className="mt-5 text-sm leading-relaxed text-ink-muted">
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
