"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/guards";
import { cancelMyReservation } from "@/lib/booking/my-bookings";
import { MISSING_ID_MESSAGE, readId } from "@/lib/form-data";

/**
 * สถานะที่ useActionState ใช้แสดงข้อความ inline
 * null = ยังไม่มีการส่ง, { ok: true } = ยกเลิกสำเร็จ (หน้าถูก revalidate แล้ว)
 */
export type CancelActionState = { ok: true } | { ok: false; message: string } | null;

const HISTORY_PATH = "/user/history";
const BOOKING_PATH = "/user/booking";

/**
 * ยกเลิกการจองของตัวเอง (TOR ข้อ 6.4) — requireUser ในตัว เพราะ Server Action
 * เรียกได้โดยตรงทาง POST ตัวตนผู้ใช้จึงต้องถูกตรวจที่นี่เสมอ
 * กติกาทั้งหมด (PENDING + ก่อนเวลาเริ่ม + เจ้าของ) อยู่ที่ชั้น cancelMyReservation
 */
export async function cancelBooking(
  _prevState: CancelActionState,
  formData: FormData,
): Promise<CancelActionState> {
  const user = await requireUser();

  const id = readId(formData);

  if (!id) {
    return { ok: false, message: MISSING_ID_MESSAGE };
  }

  const result = await cancelMyReservation(id, user.id);

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  // รายการเปลี่ยนสถานะแล้ว — รีเฟรชทั้งหน้าประวัติและตารางว่างของหน้าจอง
  revalidatePath(HISTORY_PATH);
  revalidatePath(BOOKING_PATH);

  return { ok: true };
}
