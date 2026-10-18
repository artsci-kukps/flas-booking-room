"use client";

import { useActionState, useEffect, useId, useRef } from "react";

import Alert from "@/components/alert";

import { createHoliday, type HolidayActionState } from "./actions";

const INITIAL_STATE: HolidayActionState = null;

type HolidayFormProps = {
  /** แจ้งผลลัพธ์กลับไปให้หน้าจอ: ข้อความสำเร็จ หรือ null เมื่อล้มเหลว (ล้างข้อความเดิม) */
  onResult: (message: string | null) => void;
};

/**
 * ฟอร์มเพิ่มวันหยุดนักขัตฤกษ์ — เพิ่มแล้วล้างฟอร์มและแจ้งเตือน
 * วันที่ซ้ำกับที่มีอยู่จะถูกปฏิเสธ (unique index ที่ DB + ข้อความไทย)
 */
export default function HolidayForm({ onResult }: HolidayFormProps) {
  const [state, action, pending] = useActionState(createHoliday, INITIAL_STATE);

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state) {
      return;
    }

    if (!state.ok) {
      onResult(null);
      return;
    }

    onResult("เพิ่มวันหยุดแล้ว");
    formRef.current?.reset();
  }, [state, onResult]);

  const fieldId = useId();
  const errorMessage = state && !state.ok ? state.message : null;

  return (
    <form ref={formRef} action={action} className="panel p-5 sm:p-6">
      <h2 className="text-base font-semibold tracking-tight text-ink">เพิ่มวันหยุดนักขัตฤกษ์</h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-muted">
        วันที่เพิ่มจะปิดรับจองทั้งระบบ วันเสาร์–อาทิตย์ปิดอยู่แล้ว ไม่ต้องลงข้อมูล
        และห้ามมีรายการซ้ำกันในวันเดียวกัน
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${fieldId}-date`} className="field-label">
            วันที่หยุด
          </label>
          <input
            id={`${fieldId}-date`}
            type="date"
            name="holidayDate"
            required
            className="field tabular-nums"
          />
        </div>

        <div>
          <label htmlFor={`${fieldId}-name`} className="field-label">
            ชื่อวันหยุด
          </label>
          <input
            id={`${fieldId}-name`}
            name="name"
            maxLength={200}
            required
            autoComplete="off"
            placeholder="เช่น วันจักรี"
            className="field"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor={`${fieldId}-note`} className="field-label">
            หมายเหตุ (ถ้ามี)
          </label>
          <input
            id={`${fieldId}-note`}
            name="note"
            autoComplete="off"
            placeholder="เช่น ชดเชยวันเสาร์"
            className="field"
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} aria-busy={pending} className="btn btn-primary">
          {pending ? "กำลังบันทึก…" : "เพิ่มวันหยุด"}
        </button>
      </div>

      {errorMessage ? <Alert tone="danger" heading={errorMessage} className="mt-4" /> : null}
    </form>
  );
}
