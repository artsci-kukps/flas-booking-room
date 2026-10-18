"use client";

import { useActionState, useState } from "react";

import Alert from "@/components/alert";
import type { ServicePeriodRow } from "@/lib/admin/service-periods";

import { deleteServicePeriod, type ServicePeriodActionState } from "./actions";

const INITIAL_STATE: ServicePeriodActionState = null;

type ServicePeriodRowActionsProps = {
  row: ServicePeriodRow;
  /** เปิดฟอร์มแก้ไขของแถวนี้ที่แผงด้านบน */
  onEdit: () => void;
  className?: string;
};

/**
 * ปุ่มจัดการช่วงเวลาหนึ่งแถว — แก้ไข และลบ (hard delete)
 * ใช้ useActionState เพื่อปิดปุ่มระหว่างบันทึกและแสดงข้อผิดพลาด inline
 */
export default function ServicePeriodRowActions({
  row,
  onEdit,
  className,
}: ServicePeriodRowActionsProps) {
  const [state, action, pending] = useActionState(deleteServicePeriod, INITIAL_STATE);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  if (isConfirmingDelete) {
    return (
      <div
        className={`flex flex-wrap items-start justify-end gap-2${className ? ` ${className}` : ""}`}
      >
        <span className="text-sm text-ink">ยืนยันลบช่วงเวลานี้หรือไม่?</span>
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
      <button type="button" onClick={onEdit} className="btn btn-sm btn-outline whitespace-nowrap">
        แก้ไข
      </button>

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
