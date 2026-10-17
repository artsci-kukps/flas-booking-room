"use client";

import { useActionState, useState } from "react";

import Alert from "@/components/alert";

import { restoreRoom, type RoomActionState } from "./actions";

const INITIAL_STATE: RoomActionState = null;

type RoomRestoreButtonProps = {
  id: string;
  className?: string;
};

/**
 * ปุ่มกู้คืนห้องที่ถูกลบ — ใช้ useActionState เพื่อปิดปุ่มระหว่างบันทึก
 * และแสดงข้อผิดพลาดแบบ inline เมื่อกู้คืนไม่ได้ (เช่น ชื่อไปชนกับห้องที่ใช้งานอยู่)
 */
export default function RoomRestoreButton({ id, className }: RoomRestoreButtonProps) {
  const [state, action, pending] = useActionState(restoreRoom, INITIAL_STATE);
  const [isConfirmingRestore, setIsConfirmingRestore] = useState(false);

  if (isConfirmingRestore) {
    return (
      <div
        className={`flex flex-wrap items-start justify-end gap-2${className ? ` ${className}` : ""}`}
      >
        <span className="text-sm text-ink">ยืนยันกู้คืนรายการนี้หรือไม่?</span>
        <form action={action}>
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="btn btn-sm btn-outline whitespace-nowrap"
          >
            {pending ? "กำลังกู้คืน…" : "ยืนยัน"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setIsConfirmingRestore(false)}
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
    <div
      className={`flex flex-wrap items-start justify-end gap-2${className ? ` ${className}` : ""}`}
    >
      <button
        type="button"
        onClick={() => setIsConfirmingRestore(true)}
        disabled={pending}
        aria-busy={pending}
        className="btn btn-sm btn-outline whitespace-nowrap"
      >
        {pending ? "กำลังกู้คืน…" : "กู้คืน"}
      </button>

      {state && !state.ok ? (
        <Alert tone="danger" heading={state.message} className="w-full" />
      ) : null}
    </div>
  );
}
