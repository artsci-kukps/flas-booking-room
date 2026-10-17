"use client";

import { useActionState } from "react";

import Alert from "@/components/alert";

import { restoreRoomType, type RoomTypeActionState } from "./actions";

const INITIAL_STATE: RoomTypeActionState = null;

type RoomTypeRestoreButtonProps = {
  id: string;
  className?: string;
};

/**
 * ปุ่มกู้คืนประเภทห้องที่ถูกลบ — ใช้ useActionState เพื่อปิดปุ่มระหว่างบันทึก
 * และแสดงข้อผิดพลาดแบบ inline เมื่อกู้คืนไม่ได้ (เช่น รหัส/ชื่อไปชนกับรายการที่ใช้งานอยู่)
 */
export default function RoomTypeRestoreButton({ id, className }: RoomTypeRestoreButtonProps) {
  const [state, action, pending] = useActionState(restoreRoomType, INITIAL_STATE);

  return (
    <div
      className={`flex flex-wrap items-start justify-end gap-2${className ? ` ${className}` : ""}`}
    >
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="btn btn-sm btn-outline whitespace-nowrap"
        >
          {pending ? "กำลังกู้คืน…" : "กู้คืน"}
        </button>
      </form>

      {state && !state.ok ? (
        <Alert tone="danger" heading={state.message} className="w-full" />
      ) : null}
    </div>
  );
}
