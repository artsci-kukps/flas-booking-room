"use client";

import { useActionState, useEffect, useId, useRef } from "react";

import Alert from "@/components/alert";
import FieldSelect from "@/components/field-select";
import type { AdminRoomRow } from "@/lib/admin/rooms";

import { createRoomBlock, type RoomBlockActionState } from "./actions";

const INITIAL_STATE: RoomBlockActionState = null;

type RoomBlockFormProps = {
  /** ห้องที่ยังใช้งานอยู่ สำหรับดรอปดาวน์ */
  rooms: AdminRoomRow[];
  /** แจ้งผลลัพธ์กลับไปให้หน้าจอ: ข้อความสำเร็จ หรือ null เมื่อล้มเหลว (ล้างข้อความเดิม) */
  onResult: (message: string | null) => void;
};

/**
 * ฟอร์มเพิ่มการบล็อกห้อง — ระบุห้อง ช่วงเวลา และเหตุผล (บังคับ)
 * เวลาที่กรอกเป็นเวลาเขตไทย (Asia/Bangkok) — server จะแปลงเป็น UTC ก่อนบันทึก
 * สำเร็จ → ล้างฟอร์มและแจ้งเตือน; ล้มเหลว → แสดงข้อความ inline ในฟอร์ม
 */
export default function RoomBlockForm({ rooms, onResult }: RoomBlockFormProps) {
  const [state, action, pending] = useActionState(createRoomBlock, INITIAL_STATE);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state) {
      return;
    }

    if (!state.ok) {
      onResult(null);
      return;
    }

    onResult("เพิ่มการบล็อกห้องแล้ว");
    formRef.current?.reset();
  }, [state, onResult]);

  const fieldId = useId();
  const errorMessage = state && !state.ok ? state.message : null;

  return (
    <form ref={formRef} action={action} className="panel p-5 sm:p-6">
      <h2 className="text-base font-semibold tracking-tight text-ink">เพิ่มการบล็อกห้อง</h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-muted">
        เลือกห้อง ระบุช่วงเวลาที่จะปิด และเหตุผล — ช่วงเวลาห้ามทับกับการบล็อกเดิมของห้องเดียวกัน
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${fieldId}-room`} className="field-label">
            ห้อง
          </label>
          <FieldSelect id={`${fieldId}-room`} name="roomId" required defaultValue="">
            <option value="" disabled>
              เลือกห้อง
            </option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} ({room.roomTypeName})
              </option>
            ))}
          </FieldSelect>
        </div>

        <div>
          <label htmlFor={`${fieldId}-reason`} className="field-label">
            เหตุผล
          </label>
          <input
            id={`${fieldId}-reason`}
            name="reason"
            maxLength={500}
            required
            autoComplete="off"
            placeholder="เช่น ปิดปรับปรุงแอร์"
            className="field"
          />
        </div>

        <div>
          <label htmlFor={`${fieldId}-start`} className="field-label">
            เวลาเริ่มต้น
          </label>
          <input
            id={`${fieldId}-start`}
            type="datetime-local"
            name="startTime"
            required
            step={60}
            className="field tabular-nums"
          />
        </div>

        <div>
          <label htmlFor={`${fieldId}-end`} className="field-label">
            เวลาสิ้นสุด
          </label>
          <input
            id={`${fieldId}-end`}
            type="datetime-local"
            name="endTime"
            required
            step={60}
            className="field tabular-nums"
          />
        </div>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-ink-muted">
        ระบบคิดเวลาตามเขตเวลาไทย (Asia/Bangkok)
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} aria-busy={pending} className="btn btn-primary">
          {pending ? "กำลังบันทึก…" : "เพิ่มการบล็อก"}
        </button>
      </div>

      {errorMessage ? <Alert tone="danger" heading={errorMessage} className="mt-4" /> : null}
    </form>
  );
}
