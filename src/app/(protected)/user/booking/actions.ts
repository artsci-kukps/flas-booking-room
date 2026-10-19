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
    revalidate: "/user/booking",
    confirmationPath: "/user/booking/confirmation",
  });
}
