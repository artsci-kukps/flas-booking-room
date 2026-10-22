"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { performBookingAction, type BookingActionState } from "@/lib/booking/booking-action";

/**
 * จองห้องของหน้าแอดมิน — แอดมินจองเพื่อตัวเองได้ด้วยกติกาเดียวกับผู้ใช้
 * ปลายทางหน้ายืนยันเป็นของฝั่งแอดมิน จึงไม่ถูกเปลี่ยนเส้นทางกลับจากพื้นที่ผู้ใช้
 */
export async function bookRoom(
  _prevState: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const admin = await requireAdmin();

  return performBookingAction({
    formData,
    userId: admin.id,
    confirmationPath: "/admin/booking/confirmation",
  });
}

/**
 * จองห้องจากคลิกช่องว่างในตาราง (/admin/table) — ต่างจาก bookRoom ตรงที่ "ไม่พาไปหน้ายืนยัน"
 * แอดมินยังอยู่ที่หน้าตาราง ต้องเห็นช่องที่เพิ่งจองเปลี่ยนเป็น "ไม่ว่าง" ทันที (ticket #22)
 * จึงคืนรหัสการจองกลับไปให้ popup แสดงผลแทนการ redirect
 */
export async function bookRoomFromTable(
  _prevState: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const admin = await requireAdmin();

  return performBookingAction({
    formData,
    userId: admin.id,
    confirmationPath: "/admin/booking/confirmation",
    redirectOnSuccess: false,
  });
}
