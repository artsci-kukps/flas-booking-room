"use client";

import { useActionState, useState } from "react";

import Alert from "@/components/alert";
import RoomTypeCodeBadge from "@/components/room-type-code-badge";
import type { RoomDayAvailability } from "@/lib/booking/day-availability";
import { slotAriaLabel, slotChipClass, slotStatusLabel } from "@/lib/booking/slot-display";
import {
  toggleSlotSelection,
  type SlotSelection,
} from "@/lib/booking/slot-selection";

import { bookRoom } from "./actions";

/**
 * แผงเลือกช่องว่างเพื่อยืนยันการจอง 1 บล็อก (TOR ข้อ 5.3: เลือกเป็นบล็อกเท่านั้น)
 * ช่องที่เลือกไม่ได้ (ผ่านไปแล้ว/ถูกบล็อก/เต็ม/มีคนจอง EXCLUSIVE) ถูก disabled อยู่แล้ว —
 * ปุ่มของช่องที่เลือกได้สลับการเลือก (กดซ้ำ = ยกเลิก) แล้วยืนยันผ่านฟอร์ม bookRoom
 * หน้าที่ตรวจกติกาทั้งหมดอยู่ที่ server action — ที่นี่แค่เลือกและส่ง
 */

type SlotPickerProps = {
  /** 'YYYY-MM-DD' — วันที่หน้าจองกำลังดูอยู่ */
  date: string;
  rooms: RoomDayAvailability[];
};

export default function SlotPicker({ date, rooms }: SlotPickerProps) {
  const [selected, setSelected] = useState<SlotSelection | null>(null);
  const [state, formAction, pending] = useActionState(bookRoom, null);

  const isSelected = (room: RoomDayAvailability, start: string): boolean =>
    selected?.roomId === room.id && selected.start === start;

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        {rooms.map((room) => (
          <div key={room.id} className="panel">
            <div className="flex flex-wrap items-start gap-3 p-5">
              <RoomTypeCodeBadge code={room.roomTypeCode} />
              <div className="min-w-0 flex-1">
                <h3 className="text-[1.0625rem] font-semibold tracking-tight text-ink">
                  {room.name}
                </h3>
                <p className="mt-0.5 text-sm text-ink-muted">{room.roomTypeName}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-border p-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {room.slots.map((slot) => {
                const aria = slotAriaLabel(slot, room.bookingMode, room.maxCapacity);
                const status = slotStatusLabel(slot, room.bookingMode, room.maxCapacity);
                const active = isSelected(room, slot.start);
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
        ))}
      </div>

      <div className="panel p-5">
        <form action={formAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="date" value={date} />
          {selected ? (
            <>
              <input type="hidden" name="roomId" value={selected.roomId} />
              <input type="hidden" name="startTime" value={selected.start} />
              <input type="hidden" name="endTime" value={selected.end} />
            </>
          ) : null}

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-ink-muted">การจองของคุณ</p>
            <p className="mt-0.5 text-base font-semibold text-ink">
              {selected
                ? `ห้อง ${selected.roomName} · ${selected.start}–${selected.end} น.`
                : "แตะช่องว่างเพื่อเลือก 1 บล็อก (1 ชั่วโมง)"}
            </p>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={!selected || pending}
          >
            {pending ? "กำลังจอง…" : "ยืนยันการจอง"}
          </button>
        </form>

        {state ? (
          <Alert tone="danger" heading="จองไม่สำเร็จ" body={state.message} className="mt-4" />
        ) : null}
      </div>
    </div>
  );
}
