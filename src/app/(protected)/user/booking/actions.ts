"use server";

import { requireUser } from "@/lib/auth/guards";
import { performBookingAction, type BookingActionState } from "@/lib/booking/booking-action";

/**
 * จองห้องของหน้าผู้ใช้ — ตรวจสิทธิ์ด้วย requireUser ในตัว (Server Action เรียกตรงทาง POST ได้)
 * เนื้อการจองอยู่ที่ performBookingAction ร่วมกับหน้าแอดมิน
 */
export async function bookRoom(
  _prevState: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const user = await requireUser();

  return performBookingAction({
    formData,
    userId: user.id,
    confirmationPath: "/user/booking/confirmation",
  });
}

/**
 * จองห้องจากคลิกช่องว่างในตาราง (/user/table) — ต่างจาก bookRoom ตรงที่ "ไม่พาไปหน้ายืนยัน"
 * ผู้ใช้ยังอยู่ที่หน้าตาราง ต้องเห็นช่องที่เพิ่งจองเปลี่ยนเป็น "ไม่ว่าง" ทันที (ticket #22)
 * จึงคืนรหัสการจองกลับไปให้ popup แสดงผลแทนการ redirect
 */
export async function bookRoomFromTable(
  _prevState: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const user = await requireUser();

  return performBookingAction({
    formData,
    userId: user.id,
    confirmationPath: "/user/booking/confirmation",
    redirectOnSuccess: false,
  });
}
