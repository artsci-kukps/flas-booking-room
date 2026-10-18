"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/guards";
import { createReservation } from "@/lib/booking/reservations";

/**
 * สถานะที่ useActionState ใช้แสดงข้อความ inline
 * null = ยังไม่มีการส่ง, { ok: false } = จองไม่สำเร็จ
 * จองสำเร็จไม่ต้องคืนสถานะ — action จะ redirect ไปหน้ายืนยันพร้อมรหัสการจองเอง
 */
export type BookingActionState = { ok: false; message: string } | null;

function readField(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** จองห้อง 1 บล็อก (TOR ข้อ 6) — requireUser ในตัว เพราะ Server Action เรียกได้โดยตรงทาง POST */
export async function bookRoom(
  _prevState: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const user = await requireUser();

  const result = await createReservation(
    {
      roomId: readField(formData, "roomId"),
      date: readField(formData, "date"),
      startTime: readField(formData, "startTime"),
      endTime: readField(formData, "endTime"),
    },
    user.id,
  );

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  revalidatePath("/user/booking");

  redirect(`/user/booking/confirmation?code=${result.bookingCode}`);
}
