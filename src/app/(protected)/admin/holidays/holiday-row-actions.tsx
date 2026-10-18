"use client";

import { useActionState, useState } from "react";

import Alert from "@/components/alert";
import type { HolidayRow } from "@/lib/admin/holidays";

import { deleteHoliday, type HolidayActionState } from "./actions";

const INITIAL_STATE: HolidayActionState = null;

type HolidayRowActionsProps = {
  row: HolidayRow;
  className?: string;
};

/**
 * ปุ่มจัดการวันหยุดหนึ่งแถว — ลบ (hard delete ไม่มี soft delete)
 * ใช้ useActionState เพื่อปิดปุ่มระหว่างบันทึกและแสดงข้อผิดพลาด inline
 */
export default function HolidayRowActions({ row, className }: HolidayRowActionsProps) {
  const [state, action, pending] = useActionState(deleteHoliday, INITIAL_STATE);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  if (isConfirmingDelete) {
    return (
      <div
        className={`flex flex-wrap items-start justify-end gap-2${className ? ` ${className}` : ""}`}
      >
        <span className="text-sm text-ink">ยืนยันลบวันหยุดนี้หรือไม่?</span>
        <form action={action}>
          <input type="hidden" name="id" value={row.id} />
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="btn btn-sm btn-danger whitespace-nowrap"
          >
            {pending ? "กำลังลบ…" : "ยืนยัน"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setIsConfirmingDelete(false)}
          disabled={pending}
          className="btn btn-sm btn-outline whitespace-nowrap"
        >
          ยกเลิก
        </button>
        {state && !state.ok ? (
          <Alert tone="danger" heading={state.message} className="w-full" />
        ) : null}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-start justify-end gap-2${className ? ` ${className}` : ""}`}>
      <button
        type="button"
        onClick={() => setIsConfirmingDelete(true)}
        disabled={pending}
        aria-busy={pending}
        className="btn btn-sm btn-danger whitespace-nowrap"
      >
        {pending ? "กำลังลบ…" : "ลบ"}
      </button>

      {state && !state.ok ? (
        <Alert tone="danger" heading={state.message} className="w-full" />
      ) : null}
    </div>
  );
}
