/**
 * การจองหลายบล็อกของผู้ใช้ (TOR ข้อ 6.1)
 * - บล็อกติดกันจริง (end == start ของบล็อกถัดไป) → รวมเป็น 1 record
 * - บล็อกที่มีช่องว่างคั่น → แยก record → ต้องยืนยันกับเจ้าหน้าที่หลายครั้ง
 *
 * ตรรกะล้วน ไม่ขึ้นกับ React/DB — ใช้ทั้งฝั่ง UI (สรุปก่อนกดยืนยัน) และฝั่ง server
 * (ตัดสินใจว่าจะสร้างกี่ record) เพื่อให้ทั้งสองฝั่งเห็นผลตรงกัน
 */

import { timeToMinutes } from "./time";

/** หนึ่งบล็อกที่ผู้ใช้เลือก — ช่วงเวลาหน้าปัดของวันที่เลือก (บล็อกยาว 1–2 ชั่วโมงตามประเภทห้อง) */
export type BookingBlock = {
  /** 'HH:MM' */
  start: string;
  /** 'HH:MM' */
  end: string;
};

/** หนึ่ง record ที่จะถูกบันทึกเป็นการจอง — ช่วงติดกันรวมเป็น record เดียว */
export type BookingRecord = {
  /** 'HH:MM' */
  start: string;
  /** 'HH:MM' */
  end: string;
  minutes: number;
};

export type BookingPlan = {
  /** record ทั้งหมด เรียงตามเวลา — 1 record = 1 รหัสการจอง = ยืนยันกับเจ้าหน้าที่ 1 ครั้ง */
  records: BookingRecord[];
  /** จำนวนครั้งที่ต้องยืนยันกับเจ้าหน้าที่ = จำนวน record */
  confirmationCount: number;
  totalMinutes: number;
};

/**
 * รวมบล็อกที่ติดกันเป็น record และแยกบล็อกที่มีช่องว่าง (TOR ข้อ 6.1)
 * เรียงตามเวลาเริ่มก่อน แล้วเดินทีละบล็อก: ต่อ record เดิมเมื่อ `end == start` ของบล็อกถัดไป
 * บล็อกที่ทับกันหรือไม่ต่อเนื่องกันจะเริ่ม record ใหม่ (การทับกันจริงถูกปฏิเสธโดยชั้นตรวจกติกา/server)
 */
export function planBooking(blocks: readonly BookingBlock[]): BookingPlan {
  const ordered = [...blocks].sort((a, b) => a.start.localeCompare(b.start));

  const records: BookingRecord[] = [];

  for (const block of ordered) {
    const start = timeToMinutes(block.start);
    const end = timeToMinutes(block.end);

    if (start === null || end === null || end <= start) {
      continue;
    }

    const last = records[records.length - 1];

    if (last && last.end === block.start) {
      last.end = block.end;
      last.minutes = (timeToMinutes(last.end) ?? 0) - (timeToMinutes(last.start) ?? 0);
    } else {
      records.push({ start: block.start, end: block.end, minutes: end - start });
    }
  }

  const totalMinutes = records.reduce((sum, record) => sum + record.minutes, 0);

  return { records, confirmationCount: records.length, totalMinutes };
}

/**
 * ตรวจระยะเวลาขั้นต่ำตามประเภทห้อง (TOR ข้อ 4) — ทุก record ต้องยาวไม่น้อยกว่าขั้นต่ำ
 * (ระยะเวลาขั้นต่ำเป็นกติกาของ "หนึ่งการจอง" ซึ่งเท่ากับหนึ่ง record)
 */
export function meetsMinDuration(plan: BookingPlan, minDurationMinutes: number): boolean {
  return (
    plan.records.length > 0 &&
    plan.records.every((record) => record.minutes >= minDurationMinutes)
  );
}
