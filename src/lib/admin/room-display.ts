import type { BookingMode } from "./room-types";

/**
 * ตัวช่วยแสดงผลของหน้าจัดการห้อง/ประเภทห้อง
 * รวมข้อความไว้ที่เดียว เพื่อให้ตารางและการ์ดใช้ค่าเดียวกัน
 */

/** ข้อความโหมดการจอง (ไทย) */
export const BOOKING_MODE_LABEL: Record<BookingMode, string> = {
  CAPACITY: "จองทับได้ตามความจุ",
  EXCLUSIVE: "ห้ามจองทับ",
};

/** ระยะเวลาเป็นนาที พร้อมหน่วย */
export function formatMinutes(minutes: number): string {
  return `${minutes} นาที`;
}
