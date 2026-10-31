import { formatThaiDate } from "@/lib/format";

/**
 * ตรรกะวันที่ของหน้าจอง — โมดูลบริสุทธิ์ ไม่แตะฐานข้อมูล
 * จึง import ได้ทั้งฝั่ง server และ client component
 *
 * หน้าจองใหม่จำกัดการเลือกวันที่ไว้ที่ "วันนี้" และ "วันพรุ่งนี้" เท่านั้น
 * (ดีไซน์: popup เลือกวันเมื่อเริ่มจอง — ticket #17)
 */

/** รูปแบบวันที่ที่รับ: 'YYYY-MM-DD' จากคอลัมน์ date ของ PG */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** หน้าต่างวันที่จองได้นับจากวันนี้: วันนี้ + วันพรุ่งนี้ — ค่านี้คือแกนเดียวที่กำหนดจำนวนวัน */
export const BOOKING_WINDOW_DAYS = 2;

/** ตัวเลือกวันที่ใน popup เริ่มจอง */
export type BookingDateOption = {
  /** 'YYYY-MM-DD' */
  date: string;
  /** 'วันนี้' หรือ 'วันพรุ่งนี้' */
  label: string;
  /** ชื่อวันในสัปดาห์ภาษาไทย เช่น 'จันทร์' */
  weekday: string;
  /** วันที่แบบไทยสั้น เช่น '19 ต.ค. 2569' */
  formatted: string;
};

/** ป้ายของตัวเลือกตามลำดับ offset จากวันนี้ — จำนวนรายการเดินตาม BOOKING_WINDOW_DAYS */
const DATE_LABELS = ["วันนี้", "วันพรุ่งนี้"] as const;

/** ตรวจวันที่ 'YYYY-MM-DD' ว่ารูปแบบถูกและเป็นวันที่มีจริงบนปฏิทิน (กัน 2026-02-30) */
export function isValidBookingDate(date: string): boolean {
  if (!DATE_PATTERN.test(date)) {
    return false;
  }

  const parsed = new Date(`${date}T12:00:00Z`);

  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.toISOString().startsWith(date);
}

/**
 * เลื่อนวันที่ 'YYYY-MM-DD' ไป n วัน (ติดลบ = ถอยหลัง) ตามปฏิทินจริง ข้ามเดือน/ปีได้
 * ไม่พึ่ง timezone ของ server (UTC เที่ยงวัน)
 */
export function shiftBookingDate(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00Z`);

  return new Date(parsed.getTime() + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

/**
 * อ่านพารามิเตอร์ ?date= ของหน้า — คืน 'YYYY-MM-DD' ที่ใช้ได้ หรือ null เมื่อไม่มี/ผิดรูปแบบ
 * (ผู้เรียกตัดสินใจเองว่าจะ fallback เป็นวันนี้หรือค่าอื่น)
 */
export function parseBookingDate(
  value: string | string[] | null | undefined,
): string | null {
  const raw = Array.isArray(value) ? value[0] : value;

  if (!raw || !isValidBookingDate(raw)) {
    return null;
  }

  return raw;
}

/** ชื่อวันในสัปดาห์ภาษาไทยของวันที่ 'YYYY-MM-DD' (เขตเวลาไทย) */
export function thaiWeekday(date: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    weekday: "long",
  }).format(new Date(`${date}T12:00:00Z`));
}

/**
 * ตัวเลือกวันที่ของ popup — วันนี้และวันพรุ่งนี้เท่านั้น เรียงตามลำดับเวลา
 * จำนวนรายการยึดที่ BOOKING_WINDOW_DAYS เสมอ ค่าคงที่จึงไม่หลุดจากพฤติกรรมจริง
 * คืนรายการว่างเมื่อวันนี้ผิดรูปแบบ เพื่อให้ผู้เรียกจัดการต่อได้โดยไม่พัง
 */
export function bookingDateOptions(today: string): BookingDateOption[] {
  if (!isValidBookingDate(today)) {
    return [];
  }

  return Array.from({ length: BOOKING_WINDOW_DAYS }, (_, offset) => {
    const date = shiftBookingDate(today, offset);
    const label = DATE_LABELS[offset] ?? `วันถัดไป ${offset} วัน`;

    return { date, label, weekday: thaiWeekday(date), formatted: formatThaiDate(date) };
  });
}

/**
 * อ่านพารามิเตอร์ ?room= ของหน้า — คืนค่าแรกที่ตัดช่องว่างแล้ว หรือ null เมื่อไม่มี
 * (ยังไม่ตรวจว่าห้องมีจริงไหม — ขั้นตอนการจองเป็นผู้ตรวจกับรายการห้อง)
 */
export function parseBookingRoomId(
  value: string | string[] | null | undefined,
): string | null {
  const raw = Array.isArray(value) ? value[0] : value;

  return raw && raw.trim() ? raw.trim() : null;
}

/** วันที่นี้อยู่ในหน้าต่างที่จองได้ (วันนี้หรือวันพรุ่งนี้ของ today) หรือไม่ */
export function isBookableBookingDate(date: string, today: string): boolean {
  if (!isValidBookingDate(date)) {
    return false;
  }

  return bookingDateOptions(today).some((option) => option.date === date);
}

