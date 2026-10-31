"use client";

import { useState } from "react";

import RoomTypeCodeBadge from "@/components/room-type-code-badge";
import { isBookableBookingDate } from "@/lib/booking/booking-date";
import type { BookRoomAction } from "@/lib/booking/booking-action";
import { dayClosedMessage } from "@/lib/booking/day-closed";
import type {
  DayAvailability,
  RoomDayAvailability,
  RoomSlotView,
} from "@/lib/booking/day-availability";
import { buildRoomTimeAxis } from "@/lib/booking/room-time-grid";
import { minutesToTime, timeToMinutes } from "@/lib/booking/time";
import {
  slotAriaLabel,
  slotChipClass,
  slotLengthLabel,
  slotStatusLabel,
  SLOT_FREE_CLASS,
  SLOT_OCCUPIED_CLASS,
  SLOT_MUTED_CLASS,
} from "@/lib/booking/slot-display";
import { formatThaiDate } from "@/lib/format";

import GridBookingDialog from "./grid-booking-dialog";

/**
 * ตารางสถานะการจอง "ห้อง × เวลา" ของวันหนึ่ง (ticket #20, spec #16)
 * แถว = ห้อง, คอลัมน์ = ช่วงเวลา (กว้างเท่า GCD ของบล็อกทุกห้อง บล็อก 2 ชม. ของ G ครอบ 2 คอลัมน์)
 * ช่องว่างแสดงสถานะด้วยสี/ป้ายเดียวกับ slot picker (ว่าง = KU, ไม่ว่าง = amber, บล็อก/ผ่านไปแล้ว = เงียบ)
 *
 * คลิกช่องที่กติกาอนุญาต → เปิด popup จองพร้อม วันที่/เวลา/ห้อง ที่เลือกไว้ล่วงหน้า
 * (GridBookingDialog → SlotPicker initialSlot) ยืนยันผ่าน bookRoom action ของพื้นที่เดิม
 * — CAPACITY/EXCLUSIVE/วันปิด/เวลาผ่านไป ตรวจที่ server เหมือนเดิมทุกประการ
 *
 * หน้าต่างการจอง = วันนี้/วันพรุ่งนี้ (booking-date) — วันอื่นที่เปิดดูได้จะเป็นตารางดูอย่างเดียว
 *
 * จอใหญ่ (md+) = ตารางจริง (table semantics), จอเล็ก = การ์ดห้องพร้อมชิปช่วงเวลา
 */

type RoomTimeGridProps = {
  /** วันของตาราง ('YYYY-MM-DD') */
  date: string;
  /** วันปัจจุบันในเขตเวลาไทย — ใช้ตัดสินว่าวันนี้รับจองผ่านตารางได้หรือไม่ */
  today: string;
  /** ความพร้อมของวันนั้นที่ดึงไว้ฝั่ง server */
  availability: DayAvailability;
  /** server action ยืนยันการจองของพื้นที่ (user/admin ส่งของตัวเองเข้ามา) */
  bookRoomAction: BookRoomAction;
};

/** สัญลักษณ์สถานะบนหัวตาราง — สีเดียวกับที่ชิปในตารางใช้จริง */
const LEGEND = [
  { label: "ว่าง", chip: SLOT_FREE_CLASS },
  { label: "ไม่ว่าง", chip: SLOT_OCCUPIED_CLASS },
  { label: "ถูกบล็อก", chip: SLOT_MUTED_CLASS },
  { label: "ผ่านไปแล้ว", chip: SLOT_MUTED_CLASS },
] as const;

/** เป้าหมายการจองจากคลิก — ห้อง + บล็อกที่คลิก (dialog อ่านค่านี้ตอน mount) */
type PickTarget = { roomId: string; slotStart: string };

/** ชิปช่วงเวลาเดียวในตาราง/การ์ด — ปุ่มเมื่อกติกาอนุญาต มิฉะนั้นเป็นป้ายสถานะเฉย ๆ */
function SlotChip({
  room,
  slot,
  bookable,
  showRange,
  onPick,
}: {
  room: RoomDayAvailability;
  slot: RoomSlotView;
  /** วันอยู่ในหน้าต่างการจองหรือไม่ — นอกหน้าต่างดูอย่างเดียว ไม่เปิด popup */
  bookable: boolean;
  /** แสดงเวลาเริ่ม–จบบนชิป (การ์ดมือถือ) — ตารางมีหัวคอลัมน์เวลาอยู่แล้ว */
  showRange: boolean;
  onPick: (roomId: string, slotStart: string) => void;
}) {
  const clickable = bookable && slot.selectable;
  const aria = slotAriaLabel(slot, room.bookingMode, room.maxCapacity);
  const status = slotStatusLabel(slot, room.bookingMode, room.maxCapacity);
  // ช่องที่ปกติกดได้แต่ถูกกันเพราะอยู่นอกหน้าต่างจอง — คงสีสถานะแต่ตัด hover/cursor ของปุ่ม
  const chip = slotChipClass(slot, { clickable });

  return (
    <button
      type="button"
      disabled={!clickable}
      aria-label={aria}
      title={aria}
      onClick={() => onPick(room.id, slot.start)}
      className={`flex min-h-[4rem] w-full flex-col items-center justify-center rounded-[6px] px-2 py-2 text-center transition-colors disabled:cursor-not-allowed ${chip}`}
    >
      {showRange ? (
        <span className="text-[0.8125rem] font-semibold tabular-nums text-ink">
          {slot.start}–{slot.end}
        </span>
      ) : null}
      <span className={showRange ? "mt-0.5 text-xs font-semibold" : "text-xs font-semibold"}>
        {status}
      </span>
    </button>
  );
}

/** ชื่อห้อง + ประเภท + ความยาวบล็อก — ใช้ทั้งหัวแถวตารางและหัวการ์ดมือถือ */
function RoomLabel({ room }: { room: RoomDayAvailability }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <RoomTypeCodeBadge code={room.roomTypeCode} />
        <span className="text-sm font-semibold text-ink">{room.name}</span>
      </div>
      <p className="mt-0.5 text-xs text-ink-muted">
        {room.roomTypeName} · บล็อกละ {slotLengthLabel(room.minDurationMinutes)}
      </p>
    </div>
  );
}

export default function RoomTimeGrid({
  date,
  today,
  availability,
  bookRoomAction,
}: RoomTimeGridProps) {
  const [target, setTarget] = useState<PickTarget | null>(null);

  if (!availability.open) {
    return (
      <div className="panel mt-4 flex items-start gap-3 p-5">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas text-ink-muted"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M8 3v4" />
            <path d="M16 3v4" />
            <path d="M3 10h18" />
            <path d="m4 4 16 16" />
          </svg>
        </span>
        <p className="text-sm leading-relaxed text-ink-muted">
          {dayClosedMessage(availability)}
        </p>
      </div>
    );
  }

  const { rooms, openTime, closeTime } = availability;
  const axis = buildRoomTimeAxis(rooms);
  const bookable = isBookableBookingDate(date, today);

  // ป้ายหัวคอลัมน์เป็นช่วงเวลาชัดเจน (08:30–09:30) ไม่ใช่แค่เวลาเริ่ม
  const unit = axis?.unit ?? 60;
  const columnRanges =
    axis?.labels.map((label) => {
      const start = timeToMinutes(label);

      return {
        start: label,
        end: start === null ? null : minutesToTime(start + unit),
      };
    }) ?? [];

  const pick = (roomId: string, slotStart: string) =>
    setTarget({ roomId, slotStart });

  const targetRoom = target
    ? (rooms.find((room) => room.id === target.roomId) ?? null)
    : null;
  const targetSlot =
    targetRoom && target
      ? (targetRoom.slots.find((slot) => slot.start === target.slotStart) ?? null)
      : null;

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <ul
          aria-label="สัญลักษณ์สถานะ"
          className="flex flex-wrap items-center gap-1.5"
        >
          {LEGEND.map((item) => (
            <li
              key={item.label}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.chip}`}
            >
              {item.label}
            </li>
          ))}
        </ul>

        <p className="text-sm tabular-nums text-ink-muted">
          เวลาให้บริการ {openTime}–{closeTime}
        </p>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        {bookable
          ? "คลิกช่องว่างในตารางเพื่อเปิด popup จองทันที — เลือกได้หลายบล็อกของห้องเดียวกัน แล้วยืนยันใน popup ได้เลย"
          : "หน้าต่างการจองคือวันนี้และวันพรุ่งนี้ — วันนี้ดูตารางได้อย่างเดียว ไม่รับจองผ่านตาราง"}
      </p>

      {axis === null ? (
        <p className="panel mt-4 p-6 text-sm text-ink-muted">
          ไม่มีช่วงเวลาให้เลือกในวันนี้
        </p>
      ) : (
        <>
          {/* จอใหญ่: ตารางห้อง × เวลา (เลื่อนแนวนอนเมื่อคอลัมน์เยอะ) */}
          <div className="panel mt-4 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[52rem] border-collapse text-left">
              <caption className="sr-only">
                ตารางสถานะการจองของทุกห้อง วันที่ {formatThaiDate(date)}
              </caption>
              <thead>
                <tr className="border-b border-border bg-canvas">
                  <th scope="col" className="w-[17rem] px-4 py-3 text-xs font-semibold text-ink-muted">
                    ห้อง
                  </th>
                  {columnRanges.map(({ start, end }) => (
                    <th
                      key={start}
                      scope="col"
                      className="whitespace-nowrap px-1 py-3 text-center text-xs tabular-nums"
                    >
                      <span className="font-semibold text-ink">{start}</span>
                      {end ? <span className="text-ink-muted">–{end}</span> : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rooms.map((room) => {
                  const consumed = room.slots.reduce(
                    (sum, slot) => sum + axis.spanOf(slot),
                    0,
                  );
                  const tail = axis.columns - consumed;

                  return (
                    <tr key={room.id} className="transition-colors hover:bg-canvas">
                      <th scope="row" className="px-4 py-3 text-left font-normal">
                        <RoomLabel room={room} />
                      </th>
                      {room.slots.map((slot) => (
                        <td key={slot.start} colSpan={axis.spanOf(slot)} className="p-0.5">
                          <SlotChip
                            room={room}
                            slot={slot}
                            bookable={bookable}
                            showRange={axis.spanOf(slot) > 1}
                            onPick={pick}
                          />
                        </td>
                      ))}
                      {tail > 0 ? (
                        <td colSpan={tail} aria-hidden="true" />
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* มือถือ: การ์ดห้องพร้อมชิปช่วงเวลา (มีเวลาบนชิปเพราะไม่มีหัวคอลัมน์) */}
          <ul className="mt-4 grid gap-3 md:hidden">
            {rooms.map((room) => (
              <li key={room.id} className="panel p-4">
                <RoomLabel room={room} />
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {room.slots.map((slot) => (
                    <SlotChip
                      key={slot.start}
                      room={room}
                      slot={slot}
                      bookable={bookable}
                      showRange
                      onPick={pick}
                    />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {target && targetRoom && targetSlot ? (
        <GridBookingDialog
          key={`${targetRoom.id}-${target.slotStart}`}
          date={date}
          room={targetRoom}
          slot={targetSlot}
          openTime={openTime}
          closeTime={closeTime}
          bookRoomAction={bookRoomAction}
          onClose={() => setTarget(null)}
        />
      ) : null}
    </>
  );
}
