"use client";

import { useActionState } from "react";

import Alert from "@/components/alert";
import type { AdminRoomRow } from "@/lib/admin/rooms";

import { deleteRoom, type RoomActionState } from "./actions";

const INITIAL_STATE: RoomActionState = null;

type RoomRowActionsProps = {
  row: AdminRoomRow;
  /** เปิดฟอร์มแก้ไขของแถวนี้ที่แผงด้านบน */
  onEdit: () => void;
  className?: string;
};

/**
 * ปุ่มจัดการห้องหนึ่งแถว — แก้ไข และลบ (soft delete)
 * ใช้ useActionState เพื่อปิดปุ่มระหว่างบันทึกและแสดงข้อผิดพลาด inline
 * ห้องที่ถูกลบจะไม่ปรากฏในรายการและไม่ถูกนำไปจอง
 */
export default function RoomRowActions({ row, onEdit, className }: RoomRowActionsProps) {
  const [state, action, pending] = useActionState(deleteRoom, INITIAL_STATE);

  return (
    <div
      className={`flex flex-wrap items-start justify-end gap-2${className ? ` ${className}` : ""}`}
    >
      <button type="button" onClick={onEdit} className="btn btn-sm btn-outline whitespace-nowrap">
        แก้ไข
      </button>

      <form action={action}>
        <input type="hidden" name="id" value={row.id} />
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="btn btn-sm btn-danger whitespace-nowrap"
        >
          {pending ? "กำลังลบ…" : "ลบ"}
        </button>
      </form>

      {state && !state.ok ? (
        <Alert tone="danger" heading={state.message} className="w-full" />
      ) : null}
    </div>
  );
}
