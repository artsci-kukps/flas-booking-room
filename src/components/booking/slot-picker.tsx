"use client";

import { useActionState, useState, type ReactNode } from "react";

import Alert from "@/components/alert";
import { meetsMinDuration, planBooking } from "@/lib/booking/booking-plan";
import type { RoomDayAvailability } from "@/lib/booking/day-availability";
import { slotAriaLabel, slotChipClass, slotStatusLabel } from "@/lib/booking/slot-display";
import { toggleSlotSelection, type SlotSelection } from "@/lib/booking/slot-selection";
import { formatThaiDate } from "@/lib/format";

import type { BookRoomAction } from "@/lib/booking/booking-action";

import BookingSummary from "./booking-summary";

/**
 * ตัวเลือกช่องว่างเพื่อยืนยันการจอง (TOR ข้อ 5.3, 6.1: เลือกเป็นบล็อกเท่านั้น)
 * เลือกได้หลายบล็อกของ "ห้องเดียวกัน" (คลิกช่องอีกครั้งเพื่อยกเลิก) แล้วยืนยันผ่านฟอร์ม bookRoom
 * ระหว่างเลือกแสดงสรุป (ห้อง วันที่ ช่วงเวลา) ให้เห็นก่อนกดจอง — ticket #19 รวมทุกขั้นตอนไว้ใน popup
 * หน้าที่ตรวจกติกาทั้งหมดอยู่ที่ server action — ที่นี่แค่เลือก สรุป และส่ง
 *
 * แสดงผล "ห้องเดียว" ต่อหนึ่ง popup (header ห้อง/ป้ายประเภทอยู่ที่หัว popup เอง)
 * ข้อมูลห้องทั้งหมดมาจาก DayAvailability ที่หน้าจองดึงไว้แล้ว — ไม่คำนวณซ้ำที่ client
 */

type SlotPickerProps = {
  /** 'YYYY-MM-DD' — วันที่ที่ popup กำลังเลือกอยู่ */
  date: string;
  /** ห้องที่เลือกใน popup พร้อมช่องว่างของวันนั้น */
  room: RoomDayAvailability;
  /** server action ที่รับผิดชอบการจอง — หน้าผู้ใช้/แอดมินส่งของตัวเองเข้ามา */
  bookRoomAction: BookRoomAction;
  /** ปุ่มเสริมข้างปุ่มยืนยันในฟอร์ม (popup ใช้เป็นปุ่ม "ยกเลิก") */
  secondaryAction?: ReactNode;
};

export default function SlotPicker({
  date,
  room,
  bookRoomAction,
  secondaryAction,
}: SlotPickerProps) {
  const [selected, setSelected] = useState<SlotSelection | null>(null);
  const [state, formAction, pending] = useActionState(bookRoomAction, null);

  const isSelected = (start: string): boolean =>
    selected?.roomId === room.id && selected.blocks.some((block) => block.start === start);

  const plan = planBooking(selected?.blocks ?? []);
  const durationOk = meetsMinDuration(plan, room.minDurationMinutes);
  const canSubmit = Boolean(selected) && plan.records.length > 0 && durationOk && !pending;

  return (
    <div className="space-y-4">
      <div className="panel">
        <div className="grid grid-cols-2 gap-2 p-5 sm:grid-cols-3">
          {room.slots.map((slot) => {
            const aria = slotAriaLabel(slot, room.bookingMode, room.maxCapacity);
            const status = slotStatusLabel(slot, room.bookingMode, room.maxCapacity);
            const active = isSelected(slot.start);
            // ช่องที่เลือกอยู่: KU เต็มสี ตัดขาดจากสถานะเดิมให้เห็นชัดว่ากำลังจะยืนยันช่องนี้
            const chip = active
              ? "border-ku bg-ku text-white"
              : `border-border ${slotChipClass(slot)}`;

            return (
              <button
                key={`${room.id}-${slot.start}`}
                type="button"
                className={`flex flex-col items-center justify-center rounded-[12px] border px-3 py-3 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${chip}`}
                aria-label={aria}
                aria-pressed={active}
                disabled={!slot.selectable}
                onClick={() =>
                  setSelected(toggleSlotSelection(selected, room, slot))
                }
              >
                <span
                  className={`text-sm font-semibold tabular-nums ${active ? "text-white" : "text-ink"}`}
                >
                  {slot.start}–{slot.end}
                </span>
                <span className="mt-1 text-xs">{status}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="panel p-5">
        <form action={formAction} className="flex flex-wrap items-start gap-3">
          <input type="hidden" name="date" value={date} />
          {selected ? (
            <>
              <input type="hidden" name="roomId" value={selected.roomId} />
              <input
                type="hidden"
                name="blocks"
                value={JSON.stringify(selected.blocks)}
              />
            </>
          ) : null}

          <div className="min-w-0 flex-1">
            <BookingSummary
              plan={plan}
              roomName={room.name}
              minDurationMinutes={room.minDurationMinutes}
              dateLabel={formatThaiDate(date)}
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
              {pending ? "กำลังจอง…" : "ยืนยันการจอง"}
            </button>
            {secondaryAction}
          </div>
        </form>

        {state ? (
          <Alert tone="danger" heading="จองไม่สำเร็จ" body={state.message} className="mt-4" />
        ) : null}
      </div>
    </div>
  );
}
