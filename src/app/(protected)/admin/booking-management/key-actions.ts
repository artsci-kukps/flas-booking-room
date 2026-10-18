"use server";

import { revalidatePath } from "next/cache";

import * as bookingAdmin from "@/lib/admin/booking-admin";
import type { BookingAdminResult } from "@/lib/admin/booking-admin";
import { requireAdmin } from "@/lib/auth/guards";
import { MISSING_ID_MESSAGE, readId } from "@/lib/form-data";

/**
 * Server actions ของการยืนยันรับ–คืนกุญแจ (TOR ข้อ 8 · ticket #11)
 * แยกไฟล์จาก action อื่นของหน้าการจอง เพื่อให้แต่ละ ticket แตะคนละส่วน
 * ทุก action บังคับสิทธิ์แอดมินเอง เพราะ Server Action ถูกเรียกตรงทาง POST ได้
 */

/** สถานะที่ useActionState ใช้แสดงข้อความ/ผลลัพธ์ inline */
export type BookingKeyActionState = BookingAdminResult | null;

const PATH = "/admin/booking-management";

/** ยืนยันรับกุญแจ (PENDING → ACTIVE) — ผู้ยืนยันคือแอดมินที่ล็อกอินอยู่ */
export async function confirmKeyPickupAction(
  _prevState: BookingKeyActionState,
  formData: FormData,
): Promise<BookingAdminResult> {
  const admin = await requireAdmin();

  const id = readId(formData);

  if (!id) {
    return { ok: false, message: MISSING_ID_MESSAGE };
  }

  const result = await bookingAdmin.confirmKeyPickup(id, admin.id);

  if (result.ok) {
    revalidatePath(PATH);
  }

  return result;
}

/** ยืนยันคืนกุญแจ (ACTIVE → COMPLETED/LATE_RETURN) — ผู้ยืนยันคือแอดมินที่ล็อกอินอยู่ */
export async function confirmKeyReturnAction(
  _prevState: BookingKeyActionState,
  formData: FormData,
): Promise<BookingAdminResult> {
  const admin = await requireAdmin();

  const id = readId(formData);

  if (!id) {
    return { ok: false, message: MISSING_ID_MESSAGE };
  }

  const result = await bookingAdmin.confirmKeyReturn(id, admin.id);

  if (result.ok) {
    revalidatePath(PATH);
  }

  return result;
}
