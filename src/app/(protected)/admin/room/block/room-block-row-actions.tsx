"use client";

import { useActionState, useState } from "react";

import Alert from "@/components/alert";
import type { RoomBlockRow } from "@/lib/admin/room-blocks";

import { deleteRoomBlock, type RoomBlockActionState } from "./actions";

const INITIAL_STATE: RoomBlockActionState = null;

type RoomBlockRowActionsProps = {
  row: RoomBlockRow;
  className?: string;
};

/**
 * ปุ่มจัดการการบล็อกห้องหนึ่งแถว — ลบแบบ hard delete (ไม่มีกู้คืน)
 * ยืนยันก่อนลบเสมอ และใช้ useActionState เพื่อปิดปุ่มระหว่างลบ
 * แสดงข้อความผิดพลาด inline เช่น รายการถูกลบไปแล้ว
 */
export default function RoomBlockRowActions({ row, className }: RoomBlockRowActionsProps) {
  const [state, action, pending] = useActionState(deleteRoomBlock, INITIAL_STATE);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  if (isConfirmingDelete) {
    return (
      <div
        className={`flex flex-wrap items-start justify-end gap-2${className ? ` ${className}` : ""}`}
      >
        <span className="text-sm text-ink">ยืนยันลบรายการนี้หรือไม่? (ลบถาวร ไม่สามารถกู้คืนได้)</span>
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
