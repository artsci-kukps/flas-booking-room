"use server";

import { revalidatePath } from "next/cache";

import * as roomRecords from "@/lib/admin/rooms";
import type { RoomInput, RoomResult } from "@/lib/admin/rooms";
import { requireAdmin } from "@/lib/auth/guards";
import { MISSING_ID_MESSAGE, readId } from "@/lib/form-data";

/**
 * สถานะที่ useActionState ใช้แสดงข้อความ inline
 * null = ยังไม่มีการส่ง, { ok: true } = สำเร็จ, { ok: false } = ผิดพลาด
 */
export type RoomActionState = RoomResult | null;

const PATH = "/admin/rooms";

/** ช่องว่าง = null (ความจุ/สิ่งอำนวยความสะดวกไม่บังคับ) */
function readOptionalNumber(formData: FormData, key: string): number | null {
  const value = String(formData.get(key) ?? "").trim();

  return value === "" ? null : Number(value);
}

function readOptionalText(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();

  return value === "" ? null : value;
}

function readInput(formData: FormData): RoomInput {
  return {
    name: String(formData.get("name") ?? "").trim(),
    roomTypeId: String(formData.get("roomTypeId") ?? "").trim(),
    maxCapacity: readOptionalNumber(formData, "maxCapacity"),
    facilities: readOptionalText(formData, "facilities"),
  };
}

/** เพิ่มห้อง (กู้คืนแถวเดิมอัตโนมัติถ้าชื่อตรงกับห้องที่ถูกลบ) */
export async function createRoom(
  _prevState: RoomActionState,
  formData: FormData,
): Promise<RoomResult> {
  await requireAdmin();

  const result = await roomRecords.createRoom(readInput(formData));

  if (result.ok) {
    revalidatePath(PATH);
  }

  return result;
}

/** แก้ไขห้อง */
export async function updateRoom(
  _prevState: RoomActionState,
  formData: FormData,
): Promise<RoomResult> {
  await requireAdmin();

  const id = readId(formData);

  if (!id) {
    return { ok: false, message: MISSING_ID_MESSAGE };
  }

  const result = await roomRecords.updateRoom(id, readInput(formData));

  if (result.ok) {
    revalidatePath(PATH);
  }

  return result;
}

/** ลบห้องแบบ soft delete — deleted_by คือแอดมินผู้ดำเนินการ */
export async function deleteRoom(
  _prevState: RoomActionState,
  formData: FormData,
): Promise<RoomResult> {
  const admin = await requireAdmin();

  const id = readId(formData);

  if (!id) {
    return { ok: false, message: MISSING_ID_MESSAGE };
  }

  const result = await roomRecords.softDeleteRoom(id, admin.id);

  if (result.ok) {
    revalidatePath(PATH);
  }

  return result;
}

/** กู้คืนห้องที่ถูกลบ */
export async function restoreRoom(
  _prevState: RoomActionState,
  formData: FormData,
): Promise<RoomResult> {
  await requireAdmin();

  const id = readId(formData);

  if (!id) {
    return { ok: false, message: MISSING_ID_MESSAGE };
  }

  const result = await roomRecords.restoreRoom(id);

  if (result.ok) {
    revalidatePath(PATH);
  }

  return result;
}
