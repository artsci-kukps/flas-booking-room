import { asc, eq } from "drizzle-orm";

import db from "@/db";
import { roomBlock, rooms, users } from "@/db/schema";

import type { Result } from "@/lib/result";

import { pgErrorCode } from "./pg-error";

/**
 * ชั้นข้อมูล/โดเมนของการจัดการบล็อกห้อง (ไม่ใช่ "use server")
 * แอดมินปิดห้องชั่วคราว (เช่น ปิดปรับปรุง) ตาม TOR ข้อ 9
 * - เหตุผลบังคับ และห้ามมีรายการบล็อกที่ทับซ้อนกันในห้องเดียวกัน
 *   (บังคับด้วย exclusion constraint `room_block_no_overlap` ที่ระดับ DB)
 * - ลบจริง (hard delete) ไม่มี soft delete เพราะเป็นข้อมูลเชิงเวลา
 */

export type RoomBlockInput = {
  roomId: string;
  startTime: Date | null;
  endTime: Date | null;
  reason: string;
};

/** แถวการบล็อกห้องแบบแคบเท่าที่หน้าจัดการต้องใช้ พร้อมชื่อห้องและผู้สร้างสำหรับแสดงผล */
export type RoomBlockRow = {
  id: string;
  roomId: string;
  roomName: string;
  startTime: Date;
  endTime: Date;
  reason: string;
  createdBy: string;
  createdByName: string | null;
  createdByEmail: string;
  createdAt: Date;
};

/** ผลของการเพิ่ม/ลบบล็อกห้อง — คืนรูปเดียวกันให้ UI แสดงข้อความ inline ได้ */
export type RoomBlockResult = Result;

const ROOM_REQUIRED_MESSAGE = "กรุณาเลือกห้อง";
const START_REQUIRED_MESSAGE = "กรุณากรอกวันที่และเวลาเริ่มต้น";
const END_REQUIRED_MESSAGE = "กรุณากรอกวันที่และเวลาสิ้นสุด";
const ORDER_MESSAGE = "เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น";
const REASON_REQUIRED_MESSAGE = "กรุณากรอกเหตุผลการบล็อกห้อง";
const REASON_TOO_LONG_MESSAGE = "เหตุผลยาวเกิน 500 ตัวอักษร";
const OVERLAP_MESSAGE = "ช่วงเวลานี้ทับกับการบล็อกห้องเดียวกันที่มีอยู่ กรุณาเลือกช่วงเวลาอื่น";
const NOT_FOUND_MESSAGE = "ไม่พบรายการบล็อกห้องที่ต้องการลบ กรุณารีเฟรชหน้าแล้วลองใหม่";

/**
 * ตรวจค่าอินพุตของการบล็อกห้องแบบบริสุทธิ์
 * คืนข้อความภาษาไทยเมื่อไม่ผ่าน มิฉะนั้นคืน null
 */
export function validateRoomBlockInput(input: RoomBlockInput): string | null {
  if (!input.roomId.trim()) {
    return ROOM_REQUIRED_MESSAGE;
  }

  if (!input.reason.trim()) {
    return REASON_REQUIRED_MESSAGE;
  }

  if (input.reason.trim().length > 500) {
    return REASON_TOO_LONG_MESSAGE;
  }

  if (!input.startTime) {
    return START_REQUIRED_MESSAGE;
  }

  if (!input.endTime) {
    return END_REQUIRED_MESSAGE;
  }

  if (input.endTime <= input.startTime) {
    return ORDER_MESSAGE;
  }

  return null;
}

const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** UTC+7 เป็นมิลลิวินาที — Asia/Bangkok คงที่ไม่มี DST */
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * แปลงค่าจากช่อง `<input type="datetime-local">` เป็น Date ตามเขตเวลา Asia/Bangkok
 * ค่าที่ฟอร์มส่งมาเป็นเวลาหน้าปัด (ไม่มีเขตเวลา) — ระบบคิดเวลาทั้งหมดใน UTC+7
 * ซึ่งเป็นเวลาที่คงที่ (ไม่มี DST) จึงแปลงตรงด้วย offset +07:00
 * คืน null เมื่อรูปแบบหรือวัน/เวลาอยู่นอกช่วง
 */
export function parseBangkokDateTimeLocal(value: string): Date | null {
  if (!DATETIME_LOCAL_PATTERN.test(value)) {
    return null;
  }

  const date = new Date(`${value}:00+07:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  // V8 ม้วนวันที่ที่เกินช่วงข้ามเดือนได้ (เช่น 30 ก.พ. → 2 มี.ค.)
  // จึงตรวจย้อนกลับด้วยการเทียบเวลาหน้าปัด UTC+7 ที่แปลงกลับกับค่าที่กรอก
  const shifted = new Date(date.getTime() + BANGKOK_OFFSET_MS).toISOString();
  const roundTrip = `${shifted.slice(0, 10)}T${shifted.slice(11, 16)}`;

  return roundTrip === value ? date : null;
}

/**
 * รายการบล็อกห้องทั้งหมด พร้อมชื่อห้องและผู้สร้าง (fullName ถ้าไม่มีใช้อีเมล)
 * เรียงตามเวลาเริ่มต้น — join แบบ inner เพราะห้อง/ผู้ใช้ห้ามถูกลบจริง
 * (ห้องอาจถูก soft delete แต่ยังอยู่ในฐานข้อมูล รายการบล็อกเดิมจึงแสดงต่อไปได้)
 */
export async function listRoomBlocks(): Promise<RoomBlockRow[]> {
  return db
    .select({
      id: roomBlock.id,
      roomId: roomBlock.roomId,
      roomName: rooms.name,
      startTime: roomBlock.startTime,
      endTime: roomBlock.endTime,
      reason: roomBlock.reason,
      createdBy: roomBlock.createdBy,
      createdByName: users.fullName,
      createdByEmail: users.email,
      createdAt: roomBlock.createdAt,
    })
    .from(roomBlock)
    .innerJoin(rooms, eq(roomBlock.roomId, rooms.id))
    .innerJoin(users, eq(roomBlock.createdBy, users.id))
    .orderBy(asc(roomBlock.startTime));
}

/**
 * เพิ่มการบล็อกห้อง — บันทึกผู้สร้าง (แอดมินที่ดำเนินการ) ไปกับแถว
 * ช่วงเวลาที่ทับกับบล็อกเดิมของห้องเดียวกันจะถูกปฏิเสธโดย
 * exclusion constraint `room_block_no_overlap` ที่ระดับ DB (23P01)
 * แม้สองคำขอจะแข่งกัน insert ก็ตาม
 */
export async function createRoomBlock(
  input: RoomBlockInput,
  actorId: string,
): Promise<RoomBlockResult> {
  const invalid = validateRoomBlockInput(input);

  if (invalid) {
    return { ok: false, message: invalid };
  }

  try {
    await db.insert(roomBlock).values({
      roomId: input.roomId.trim(),
      startTime: input.startTime!,
      endTime: input.endTime!,
      reason: input.reason.trim(),
      createdBy: actorId,
    });

    return { ok: true };
  } catch (error) {
    if (pgErrorCode(error) === "23P01") {
      return { ok: false, message: OVERLAP_MESSAGE };
    }

    throw error;
  }
}

/** ลบการบล็อกห้องแบบ hard delete — ไม่มี soft delete ตาม TOR ข้อ 10 */
export async function deleteRoomBlock(id: string): Promise<RoomBlockResult> {
  const rows = await db
    .delete(roomBlock)
    .where(eq(roomBlock.id, id))
    .returning({ id: roomBlock.id });

  if (rows.length === 0) {
    return { ok: false, message: NOT_FOUND_MESSAGE };
  }

  return { ok: true };
}
