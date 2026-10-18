"use server";

import { revalidatePath } from "next/cache";

import * as roomTypes from "@/lib/admin/room-types";
import type { RoomTypeInput, RoomTypeResult } from "@/lib/admin/room-types";
import { requireAdmin } from "@/lib/auth/guards";
import { MISSING_ID_MESSAGE, readId } from "@/lib/form-data";

/**
 * สถานะที่ useActionState ใช้แสดงข้อความ inline
 * null = ยังไม่มีการส่ง, { ok: true } = สำเร็จ, { ok: false } = ผิดพลาด
 */
export type RoomTypeActionState = RoomTypeResult | null;

const INVALID_MODE_MESSAGE = "โหมดการจองไม่ถูกต้อง";
const PATH = "/admin/room/type";

/** แปลงค่าดิบจากฟอร์มเป็นอินพุตประเภทห้อง — คืนข้อความไทยเมื่อโหมดการจองไม่ถูกต้อง */
function readInput(formData: FormData): RoomTypeInput | string {
  const bookingMode = formData.get("bookingMode");

  if (!roomTypes.isBookingMode(bookingMode)) {
    return INVALID_MODE_MESSAGE;
  }

  return {
    code: String(formData.get("code") ?? "").trim().toUpperCase(),
    typeName: String(formData.get("typeName") ?? "").trim(),
    bookingMode,
    minDurationMinutes: Number(String(formData.get("minDurationMinutes") ?? "").trim()),
  };
}

/** เพิ่มประเภทห้อง (กู้คืนแถวเดิมอัตโนมัติถ้ารหัส/ชื่อตรงกับรายการที่ถูกลบ) */
export async function createRoomType(
  _prevState: RoomTypeActionState,
  formData: FormData,
): Promise<RoomTypeResult> {
  await requireAdmin();

  const input = readInput(formData);

  if (typeof input === "string") {
    return { ok: false, message: input };
  }

  const result = await roomTypes.createRoomType(input);

  if (result.ok) {
    revalidatePath(PATH);
  }

  return result;
}

/** แก้ไขประเภทห้อง */
export async function updateRoomType(
  _prevState: RoomTypeActionState,
  formData: FormData,
): Promise<RoomTypeResult> {
  await requireAdmin();

  const id = readId(formData);

  if (!id) {
    return { ok: false, message: MISSING_ID_MESSAGE };
  }

  const input = readInput(formData);

  if (typeof input === "string") {
    return { ok: false, message: input };
  }

  const result = await roomTypes.updateRoomType(id, input);

  if (result.ok) {
    revalidatePath(PATH);
  }

  return result;
}

/** ลบประเภทห้องแบบ soft delete — deleted_by คือแอดมินผู้ดำเนินการ */
export async function deleteRoomType(
  _prevState: RoomTypeActionState,
  formData: FormData,
): Promise<RoomTypeResult> {
  const admin = await requireAdmin();

  const id = readId(formData);

  if (!id) {
    return { ok: false, message: MISSING_ID_MESSAGE };
  }

  const result = await roomTypes.softDeleteRoomType(id, admin.id);

  if (result.ok) {
    revalidatePath(PATH);
  }

  return result;
}

/** กู้คืนประเภทห้องที่ถูกลบ */
export async function restoreRoomType(
  _prevState: RoomTypeActionState,
  formData: FormData,
): Promise<RoomTypeResult> {
  await requireAdmin();

  const id = readId(formData);

  if (!id) {
    return { ok: false, message: MISSING_ID_MESSAGE };
  }

  const result = await roomTypes.restoreRoomType(id);

  if (result.ok) {
    revalidatePath(PATH);
  }

  return result;
}
