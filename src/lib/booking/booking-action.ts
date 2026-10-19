import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { readField } from "@/lib/form-data";

import type { BookingBlock } from "./booking-plan";
import { submitBookingSelection } from "./reservations";

/**
 * สัญญาร่วมของ server action "จองห้อง" — ใช้ทั้งหน้าผู้ใช้และหน้าแอดมิน
 * โมดูลนี้บริสุทธิ์ (ไม่ใช่ "use server") เพื่อให้ฝั่ง UI import เฉพาะชนิดข้อมูลได้
 */

/** สถานะที่ useActionState ใช้แสดงข้อความ inline: null = ยังไม่ส่ง, ok:false = จองไม่สำเร็จ */
export type BookingActionState = { ok: false; message: string } | null;

/** รูปร่างของ server action ที่ปุ่มยืนยันการจองเรียกผ่าน useActionState */
export type BookRoomAction = (
  prevState: BookingActionState,
  formData: FormData,
) => Promise<BookingActionState>;

function isBlock(value: unknown): value is BookingBlock {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const block = value as Partial<BookingBlock>;

  return typeof block.start === "string" && typeof block.end === "string";
}

/**
 * อ่านฟิลด์ blocks (JSON array ของ { start, end }) จากฟอร์มจอง
 * ค่าที่ผิดรูปแบบถือเป็นรายการว่าง — ชั้นตรวจกติกาจะตอบกลับข้อความให้เลือกใหม่
 */
export function readBookingBlocks(formData: FormData): BookingBlock[] {
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

type BookingActionContext = {
  formData: FormData;
  /** ผู้จอง — มาจาก requireUser/requireAdmin ของแต่ละพื้นที่ */
  userId: string;
  /** ปลายทางหน้ายืนยัน เช่น '/user/booking/confirmation' */
  confirmationPath: string;
};

/**
 * เส้นทางทั้งหมดที่แสดง "ความพร้อมของการจอง" — popup จอง, ตารางห้อง×เวลา และหน้าจัดการ
 * การจอง/ยกเลิก/เปลี่ยนสถานะ 1 ครั้งมีผลกับทุกหน้าเหล่านี้พร้อมกัน
 * (เช่น ผู้ใช้จอง → ช่องว่างหายไปจากตารางของแอดมินด้วย)
 * จึง revalidate ทุกเส้นทางเสมอ เพื่อให้สถานะอัปเดตทันทีทุกหน้า (ticket #22)
 */
export const AVAILABILITY_PATHS = [
  "/user/booking",
  "/user/table",
  "/admin/booking",
  "/admin/table",
  "/admin/booking-management",
] as const;

/** revalidate ทุกหน้าที่แสดงความพร้อม — เรียกหลังข้อมูลการจอง/สถานะเปลี่ยนสำเร็จ */
export function revalidateAvailability(): void {
  for (const path of AVAILABILITY_PATHS) {
    revalidatePath(path);
  }
}

/**
 * เนื้อร่วมของการจองจากฟอร์ม — ใช้ทั้งหน้าผู้ใช้และแอดมิน
 * ตรวจกติกา/สร้าง record อยู่ที่ submitBookingSelection; ที่นี่แค่แปลงฟอร์มและนำทาง
 * ผู้เรียกเป็น server action ที่เรียกในบริบทของ request เสมอ (revalidatePath/redirect ใช้ได้)
 */
export async function performBookingAction({
  formData,
  userId,
  confirmationPath,
}: BookingActionContext): Promise<BookingActionState> {
  const result = await submitBookingSelection(
    {
      roomId: readField(formData, "roomId"),
      date: readField(formData, "date"),
      blocks: readBookingBlocks(formData),
    },
    userId,
  );

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  revalidateAvailability();

  const params = new URLSearchParams();

  for (const code of result.bookingCodes) {
    params.append("code", code);
  }

  redirect(`${confirmationPath}?${params.toString()}`);
}
