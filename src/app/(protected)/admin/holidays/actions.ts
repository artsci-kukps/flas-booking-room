"use server";

import { revalidatePath } from "next/cache";

import * as holidays from "@/lib/admin/holidays";
import type { HolidayInput, HolidayResult } from "@/lib/admin/holidays";
import { requireAdmin } from "@/lib/auth/guards";

/**
 * สถานะที่ useActionState ใช้แสดงข้อความ inline
 * null = ยังไม่มีการส่ง, { ok: true } = สำเร็จ, { ok: false } = ผิดพลาด
 */
export type HolidayActionState = HolidayResult | null;

const MISSING_ID_MESSAGE = "ไม่พบรายการที่ต้องการ กรุณารีเฟรชหน้าแล้วลองใหม่";
const PATH = "/admin/holidays";

function readId(formData: FormData): string {
  return String(formData.get("id") ?? "").trim();
}

/** แปลงค่าดิบจากฟอร์มเป็นอินพุตวันหยุด */
function readInput(formData: FormData): HolidayInput {
  const note = String(formData.get("note") ?? "").trim();

  return {
    holidayDate: String(formData.get("holidayDate") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    note: note ? note : null,
  };
}

/** เพิ่มวันหยุดนักขัตฤกษ์ (ห้ามซ้ำวันเดียวกัน — unique index ที่ DB) */
export async function createHoliday(
  _prevState: HolidayActionState,
  formData: FormData,
): Promise<HolidayResult> {
  const admin = await requireAdmin();

  const result = await holidays.createHoliday(readInput(formData), admin.id);

  if (result.ok) {
    revalidatePath(PATH);
  }

  return result;
}

/** ลบวันหยุด (hard delete) */
export async function deleteHoliday(
  _prevState: HolidayActionState,
  formData: FormData,
): Promise<HolidayResult> {
  await requireAdmin();

  const id = readId(formData);

  if (!id) {
    return { ok: false, message: MISSING_ID_MESSAGE };
  }

  const result = await holidays.deleteHoliday(id);

  if (result.ok) {
    revalidatePath(PATH);
  }

  return result;
}
