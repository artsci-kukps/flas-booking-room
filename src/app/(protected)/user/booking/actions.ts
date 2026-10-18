"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/guards";
import type { BookingBlock } from "@/lib/booking/booking-plan";
import { submitBookingSelection } from "@/lib/booking/reservations";
import { readField } from "@/lib/form-data";

/**
 * สถานะที่ useActionState ใช้แสดงข้อความ inline
 * null = ยังไม่มีการส่ง, { ok: false } = จองไม่สำเร็จ
 * จองสำเร็จไม่ต้องคืนสถานะ — action จะ redirect ไปหน้ายืนยันพร้อมรหัสการจองเอง
 */
export type BookingActionState = { ok: false; message: string } | null;

function isBlock(value: unknown): value is BookingBlock {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { start?: unknown; end?: unknown };

  return typeof candidate.start === "string" && typeof candidate.end === "string";
}

/**
 * อ่านบล็อกที่เลือกจาก hidden field `blocks` (JSON array ของ {start,end})
 * ค่าที่ผิดรูปแบบถือว่าไม่ได้เลือก — ชั้นจองจะตอบกลับด้วยข้อความให้เลือกใหม่
 */
function readBlocks(formData: FormData): BookingBlock[] {
  const raw = readField(formData, "blocks");

  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isBlock)
      .map((block) => ({ start: block.start.trim(), end: block.end.trim() }));
  } catch {
    return [];
  }
}

/**
 * จองห้องจากบล็อกที่เลือก (เลือกได้หลายบล็อกของห้องเดียวกัน — TOR ข้อ 6)
 * requireUser ในตัว เพราะ Server Action เรียกได้โดยตรงทาง POST
 */
export async function bookRoom(
  _prevState: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const user = await requireUser();

  const result = await submitBookingSelection(
    {
      roomId: readField(formData, "roomId"),
      date: readField(formData, "date"),
      blocks: readBlocks(formData),
    },
    user.id,
  );

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  revalidatePath("/user/booking");

  const params = new URLSearchParams();

  for (const code of result.bookingCodes) {
    params.append("code", code);
  }

  redirect(`/user/booking/confirmation?${params.toString()}`);
}
