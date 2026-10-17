"use client";

import { useActionState } from "react";

import Alert from "@/components/alert";

import { updateUserBlocked, updateUserRole, type AdminActionState } from "./actions";

type UserRowActionsProps = {
  /** id ของผู้ใช้ที่ปุ่มนี้จัดการ */
  id: string;
  role: "user" | "admin";
  isBlocked: boolean;
  /** แอดมินกำลังจัดการบัญชีของตัวเองหรือไม่ — ใช้เลือกข้อความบนปุ่ม */
  isSelf: boolean;
  className?: string;
};

const INITIAL_STATE: AdminActionState = null;

/**
 * ปุ่มจัดการผู้ใช้หนึ่งแถว — เปลี่ยนบทบาท และระงับ/ปลดระงับ
 * ใช้ useActionState เพื่อปิดปุ่มระหว่างบันทึกและแสดงข้อผิดพลาด inline
 * ไม่มีปุ่มลบผู้ใช้โดยเจตนา (TOR 3.3 ห้ามลบผู้ใช้)
 */
export default function UserRowActions({
  id,
  role,
  isBlocked,
  isSelf,
  className,
}: UserRowActionsProps) {
  const [roleState, roleAction, rolePending] = useActionState(
    updateUserRole,
    INITIAL_STATE,
  );
  const [blockState, blockAction, blockPending] = useActionState(
    updateUserBlocked,
    INITIAL_STATE,
  );

  const nextRole = role === "user" ? "admin" : "user";
  const roleLabel =
    role === "user"
      ? "ตั้งเป็นผู้ดูแลระบบ"
      : isSelf
        ? "ถอดสิทธิ์ตัวเอง"
        : "ถอดสิทธิ์ผู้ดูแล";

  return (
    <div
      className={`flex flex-wrap items-start gap-2${className ? ` ${className}` : ""}`}
    >
      <form action={roleAction}>
        <input type="hidden" name="targetId" value={id} />
        <input type="hidden" name="role" value={nextRole} />
        <button
          type="submit"
          disabled={rolePending}
          aria-busy={rolePending}
          className="btn btn-sm btn-outline whitespace-nowrap"
        >
          {rolePending ? "กำลังบันทึก…" : roleLabel}
        </button>
      </form>

      <form action={blockAction}>
        <input type="hidden" name="targetId" value={id} />
        <input type="hidden" name="blocked" value={isBlocked ? "false" : "true"} />
        <button
          type="submit"
          disabled={blockPending}
          aria-busy={blockPending}
          className={`btn btn-sm whitespace-nowrap ${isBlocked ? "btn-outline" : "btn-danger"}`}
        >
          {blockPending ? "กำลังบันทึก…" : isBlocked ? "ปลดการระงับ" : "ระงับการใช้งาน"}
        </button>
      </form>

      {roleState && !roleState.ok ? (
        <Alert tone="danger" heading={roleState.message} className="w-full" />
      ) : null}
      {blockState && !blockState.ok ? (
        <Alert tone="danger" heading={blockState.message} className="w-full" />
      ) : null}
    </div>
  );
}
