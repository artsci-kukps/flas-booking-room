"use server";

import { revalidatePath } from "next/cache";

import * as roomBlocks from "@/lib/admin/room-blocks";
import type { RoomBlockResult } from "@/lib/admin/room-blocks";
import { requireAdmin } from "@/lib/auth/guards";

/**
 * สถานะที่ useActionState ใช้แสดงข้อความ inline
 * null = ยังไม่มีการส่ง, { ok: true } = สำเร็จ, { ok: false } = ผิดพลาด
 */
export type RoomBlockActionState = RoomBlockResult | null;

const MISSING_ID_MESSAGE = "ไม่พบรายการที่ต้องการ กรุณารีเฟรชหน้าแล้วลองใหม่";
const START_INVALID_MESSAGE = "วันที่และเวลาเริ่มต้นไม่ถูกต้อง กรุณาระบุใหม่";
const END_INVALID_MESSAGE = "วันที่และเวลาสิ้นสุดไม่ถูกต้อง กรุณาระบุใหม่";
const PATH = "/admin/room/block";

function readId(formData: FormData): string {
  return String(formData.get("id") ?? "").trim();
}

/**
 * อ่านค่าจากช่อง datetime-local — แปลงเป็นเวลาตามเขต Asia/Bangkok
 * คืน null เมื่อว่าง (ให้ชั้นข้อมูลบังคับข้อความเอง) หรือคืนสตริงเมื่อรูปแบบไม่ถูกต้อง
 */
function readTime(
  formData: FormData,
  key: string,
  invalidMessage: string,
): Date | null | string {
  const raw = String(formData.get(key) ?? "").trim();

  if (!raw) {
    return null;
  }

  return roomBlocks.parseBangkokDateTimeLocal(raw) ?? invalidMessage;
}

/** เพิ่มการบล็อกห้อง — created_by คือแอดมินผู้ดำเนินการ */
export async function createRoomBlock(
  _prevState: RoomBlockActionState,
  formData: FormData,
): Promise<RoomBlockResult> {
  const admin = await requireAdmin();

  const startTime = readTime(formData, "startTime", START_INVALID_MESSAGE);

  if (typeof startTime === "string") {
    return { ok: false, message: startTime };
  }

  const endTime = readTime(formData, "endTime", END_INVALID_MESSAGE);

  if (typeof endTime === "string") {
    return { ok: false, message: endTime };
  }

  const result = await roomBlocks.createRoomBlock(
    {
      roomId: String(formData.get("roomId") ?? "").trim(),
      startTime,
      endTime,
      reason: String(formData.get("reason") ?? "").trim(),
    },
    admin.id,
  );

  if (result.ok) {
    revalidatePath(PATH);
  }

  return result;
}

/** ลบการบล็อกห้องแบบ hard delete — ไม่มี soft delete ตาม TOR ข้อ 10 */
export async function deleteRoomBlock(
  _prevState: RoomBlockActionState,
  formData: FormData,
): Promise<RoomBlockResult> {
  await requireAdmin();

  const id = readId(formData);

  if (!id) {
    return { ok: false, message: MISSING_ID_MESSAGE };
  }

  const result = await roomBlocks.deleteRoomBlock(id);

  if (result.ok) {
    revalidatePath(PATH);
  }

  return result;
}
