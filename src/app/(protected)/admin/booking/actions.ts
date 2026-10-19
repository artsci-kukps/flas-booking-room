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
