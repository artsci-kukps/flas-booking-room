import type { SlotRange } from "./day-availability";
import { minutesToTime, timeToMinutes } from "./time";

/**
 * แกนเวลาของ "ตารางห้อง × เวลา" (ticket #20, spec #16)
 * โมดูลบริสุทธิ์ — ไม่แตะฐานข้อมูล ใช้ร่วมกันทั้งฝั่ง server/client
 *
 * ห้องแต่ละประเภทมีความยาวบล็อกต่างกัน (S/P = 60 นาที, G = 120 นาที ตาม min_duration_minutes)
 * ตารางจึงวางคอลัมน์กว้างเท่า "หหารร่วมมาก (GCD)" ของบล็อกทุกห้อง แล้วให้บล็อกของแต่ละห้อง
 * ครอบ span ตามความยาวจริง — ทุกห้องเริ่มที่เวลาเปิดเดียวกัน (buildDaySlots เริ่มจาก openTime)
 * จึงวางตรงแนวเสมอ ช่องท้ายแถวของห้องที่เลิกก่อนห้องอื่นเว้นว่างไว้ (ผู้เรียกเติม span เอง)
 */

/** ผลของการวางแกนเวลาของตารางหนึ่งวัน */
export type RoomTimeAxis = {
  /** ความกว้างหนึ่งคอลัมน์ (นาที) — หหารร่วมมากของความยาวบล็อกทุกห้อง */
  unit: number;
  /** จำนวนคอลัมน์เวลาทั้งวัน (ไม่รวมคอลัมน์ชื่อห้อง) */
  columns: number;
  /** ป้าย 'HH:MM' ของหัวคอลัมน์แต่ละช่วง เรียงจากเวลาเปิด */
  labels: string[];
  /** จำนวนคอลัมน์ที่บล็อกหนึ่งครอบครอง (เท่ากับความยาวบล็อก / unit) */
  spanOf: (slot: Pick<SlotRange, "start" | "end">) => number;
};

/** หหารร่วมมากของสองจำนวนเต็มบวก */
function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);

  while (y > 0) {
    [x, y] = [y, x % y];
  }

  return x;
}

/** ช่วงเวลาที่อ่านออก (นาที) — ช่องที่รูปแบบเวลาผิดจะถูกตัดออกไม่ให้ปนแกน */
type MinuteRange = { start: number; end: number };

function toMinuteRange(slot: Pick<SlotRange, "start" | "end">): MinuteRange | null {
  const start = timeToMinutes(slot.start);
  const end = timeToMinutes(slot.end);

  if (start === null || end === null || end <= start) {
    return null;
  }

  return { start, end };
}

/**
 * สร้างแกนเวลาของตารางจากช่องว่างทุกห้องของวันนั้น
 * คืน null เมื่อไม่มีช่องว่างเลย (วันไม่มีเวลาให้บริการ) — หน้าจอแจ้งแทนการวาดตารางเปล่า
 */
export function buildRoomTimeAxis(
  rooms: readonly { slots: readonly SlotRange[] }[],
): RoomTimeAxis | null {
  const ranges = rooms.flatMap((room) => room.slots)
    .map(toMinuteRange)
    .filter((range): range is MinuteRange => range !== null);

  if (ranges.length === 0) {
    return null;
  }

  const unit = ranges.reduce((width, range) => gcd(width, range.end - range.start), 0);
  const open = Math.min(...ranges.map((range) => range.start));
  const columns = Math.max(...ranges.map((range) => Math.ceil((range.end - open) / unit)));

  return {
    unit,
    columns,
    labels: Array.from({ length: columns }, (_, index) => minutesToTime(open + index * unit)),
    spanOf: (slot) => {
      const range = toMinuteRange(slot);

      if (range === null) {
        return 1;
      }

      return Math.max(1, Math.round((range.end - range.start) / unit));
    },
  };
}
