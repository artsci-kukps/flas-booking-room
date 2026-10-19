"use server";

import * as bookingAdmin from "@/lib/admin/booking-admin";
import type { BookingAdminResult } from "@/lib/admin/booking-admin";
import { requireAdmin } from "@/lib/auth/guards";
import { revalidateAvailability } from "@/lib/booking/booking-action";
import { MISSING_ID_MESSAGE, readField } from "@/lib/form-data";

/**
 * Server actions ของการยกเลิกและแก้ไขสถานะการจอง (TOR ข้อ 6.4/7 · ticket #12)
 * แยกไฟล์จาก action อื่นของหน้าการจอง เพื่อให้แต่ละ ticket แตะคนละส่วน
 * ทุก action บังคับสิทธิ์แอดมินเอง เพราะ Server Action ถูกเรียกตรงทาง POST ได้
 */

/** ผลที่ useActionState ใช้แสดงข้อความ/สถานะใหม่ inline */
export type BookingCancelOverrideActionState = BookingAdminResult | null;

/**
 * ยกเลิกการจองทุกสถานะพร้อมเหตุผล — ช่องว่างถูกปลดล็อกทันทีเมื่อสำเร็จ
 * ข้อความ "ต้องระบุเหตุผล" มาจากชั้นข้อมูล (validateStatusReason)
 */
export async function cancelReservationAction(
  _prevState: BookingCancelOverrideActionState,
  formData: FormData,
): Promise<BookingAdminResult> {
  const admin = await requireAdmin();

  const id = readField(formData, "id");

  if (!id) {
    return { ok: false, message: MISSING_ID_MESSAGE };
  }

  const result = await bookingAdmin.cancelReservation(
    id,
    readField(formData, "reason"),
    admin.id,
  );

  if (result.ok) {
    revalidateAvailability();
  }

  return result;
}

/**
 * override สถานะการจองได้เสมอเมื่อระบบตั้งผิด (เช่น NO_SHOW → ACTIVE)
 * พร้อมบันทึกผู้ดำเนินการและเหตุผล
 */
export async function overrideReservationStatusAction(
  _prevState: BookingCancelOverrideActionState,
  formData: FormData,
): Promise<BookingAdminResult> {
  const admin = await requireAdmin();

  const id = readField(formData, "id");

  if (!id) {
    return { ok: false, message: MISSING_ID_MESSAGE };
  }

  const result = await bookingAdmin.overrideReservationStatus(
    id,
    readField(formData, "status"),
    readField(formData, "reason"),
    admin.id,
  );

  if (result.ok) {
    revalidateAvailability();
  }

  return result;
}
