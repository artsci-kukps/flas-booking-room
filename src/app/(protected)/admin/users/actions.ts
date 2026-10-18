"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/guards";
import { readField } from "@/lib/form-data";
import {
  changeUserRole,
  setUserBlocked,
  type UserAdminResult,
} from "@/lib/admin/users";

/**
 * สถานะที่ useActionState ใช้แสดงข้อความ inline
 * null = ยังไม่มีการส่ง, { ok: true } = สำเร็จ, { ok: false } = ผิดพลาด
 */
export type AdminActionState = UserAdminResult | null;

const INVALID_ROLE_MESSAGE = "บทบาทที่เลือกไม่ถูกต้อง";

/**
 * เปลี่ยนบทบาท user ↔ admin — ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์เสมอ
 * (การเปลี่ยนบทบาทไม่บันทึกผู้ดำเนินการ: v1 ไม่มีตาราง audit ตาม TOR 3.3)
 */
export async function updateUserRole(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<UserAdminResult> {
  await requireAdmin();

  const targetId = readField(formData, "targetId");
  const role = formData.get("role");

  if (role !== "user" && role !== "admin") {
    return { ok: false, message: INVALID_ROLE_MESSAGE };
  }

  const result = await changeUserRole(targetId, role);

  if (result.ok) {
    revalidatePath("/admin/users");
  }

  return result;
}

/** ระงับ/ปลดระงับบัญชี — blocked_by คือแอดมินผู้ดำเนินการ */
export async function updateUserBlocked(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<UserAdminResult> {
  const admin = await requireAdmin();

  const targetId = readField(formData, "targetId");
  const blocked = formData.get("blocked");

  if (blocked !== "true" && blocked !== "false") {
    return { ok: false, message: "สถานะการระงับไม่ถูกต้อง" };
  }

  const result = await setUserBlocked(admin.id, targetId, blocked === "true");

  if (result.ok) {
    revalidatePath("/admin/users");
  }

  return result;
}
