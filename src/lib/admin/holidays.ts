import { asc, eq } from "drizzle-orm";

import db from "@/db";
import { holiday } from "@/db/schema";

import { pgErrorCode } from "./pg-error";

/**
 * ชั้นข้อมูล/โดเมนของการจัดการวันหยุดนักขัตฤกษ์ (ไม่ใช่ "use server")
 * ตาม TOR ข้อ 9 และ A.7: ปิดทั้งระบบ แอดมินเพิ่ม/ลบได้ ห้ามซ้ำวันเดียวกัน
 * และเป็น hard delete (ข้อมูลเชิงเวลา ไม่ถูกอ้างอิงจากประวัติการจอง)
 */

/** แถววันหยุด — คอลัมน์ที่หน้าจอจัดการต้องใช้ */
export type HolidayRow = {
  id: string;
  /** 'YYYY-MM-DD' */
  holidayDate: string;
  name: string;
  note: string | null;
  createdAt: Date;
};

export type HolidayInput = {
  holidayDate: string;
  name: string;
  note: string | null;
};

/** ผลของการแก้ไขวันหยุด — คืนรูปเดียวกันให้ UI แสดงข้อความ inline ได้ */
export type HolidayResult = { ok: true } | { ok: false; message: string };

const DATE_MESSAGE = "วันที่หยุดต้องอยู่ในรูปแบบ YYYY-MM-DD";
const NAME_REQUIRED_MESSAGE = "กรุณากรอกชื่อวันหยุด";
const NAME_TOO_LONG_MESSAGE = "ชื่อวันหยุดยาวเกิน 200 ตัวอักษร";
const DUPLICATE_MESSAGE = "วันที่นี้มีวันหยุดบันทึกอยู่แล้ว ห้ามซ้ำวันเดียวกัน";
const NOT_FOUND_MESSAGE = "ไม่พบวันหยุดที่ต้องการ กรุณารีเฟรชหน้าแล้วลองใหม่";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * ตรวจค่าอินพุตของวันหยุดแบบบริสุทธิ์ (ไม่แตะฐานข้อมูล)
 * คืนข้อความภาษาไทยเมื่อไม่ผ่าน มิฉะนั้นคืน null
 */
export function validateHolidayInput(input: HolidayInput): string | null {
  if (!DATE_PATTERN.test(input.holidayDate)) {
    return DATE_MESSAGE;
  }

  const name = input.name.trim();

  if (!name) {
    return NAME_REQUIRED_MESSAGE;
  }

  if (name.length > 200) {
    return NAME_TOO_LONG_MESSAGE;
  }

  return null;
}

const HOLIDAY_COLUMNS = {
  id: holiday.id,
  holidayDate: holiday.holidayDate,
  name: holiday.name,
  note: holiday.note,
  createdAt: holiday.createdAt,
};

/** รายชื่อวันหยุด เรียงตามวันที่หยุดน้อย → มาก */
export async function listHolidays(): Promise<HolidayRow[]> {
  return db.select(HOLIDAY_COLUMNS).from(holiday).orderBy(asc(holiday.holidayDate));
}

/** เพิ่มวันหยุด — created_by คือแอดมินผู้ดำเนินการ ห้ามซ้ำวันเดียวกัน (unique index ที่ DB) */
export async function createHoliday(
  input: HolidayInput,
  actorId: string,
): Promise<HolidayResult> {
  const invalid = validateHolidayInput(input);

  if (invalid) {
    return { ok: false, message: invalid };
  }

  try {
    await db.insert(holiday).values({
      holidayDate: input.holidayDate,
      name: input.name.trim(),
      note: input.note?.trim() || null,
      createdBy: actorId,
    });

    return { ok: true };
  } catch (error) {
    if (pgErrorCode(error) === "23505") {
      return { ok: false, message: DUPLICATE_MESSAGE };
    }

    throw error;
  }
}

/** ลบวันหยุดแบบ hard delete */
export async function deleteHoliday(id: string): Promise<HolidayResult> {
  const result = await db.delete(holiday).where(eq(holiday.id, id));

  if ((result.rowCount ?? 0) === 0) {
    return { ok: false, message: NOT_FOUND_MESSAGE };
  }

  return { ok: true };
}
