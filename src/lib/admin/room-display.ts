import type { BookingMode } from "./room-types";

/**
 * ตัวช่วยแสดงผลของหน้าจัดการห้อง/ประเภทห้อง
 * รวมสำรับข้อความและสีป้ายไว้ที่เดียว เพื่อให้ตารางและการ์ดใช้ค่าเดียวกัน
 */

/** ข้อความโหมดการจอง (ไทย) */
export const BOOKING_MODE_LABEL: Record<BookingMode, string> = {
  CAPACITY: "จองทับได้ตามความจุ",
  EXCLUSIVE: "ห้ามจองทับ",
};

/**
 * สีป้ายรหัสประเภทห้อง — S = เขียวแบรนด์, G = น้ำเงิน, P = ม่วง
 * สีน้ำเงิน/ม่วงเป็น "สีจำแนกประเภท" ไม่ใช่สีเน้น (ตาม DESIGN.md) จึงใช้เฉพาะป้ายรหัส
 * รหัสอื่นนอกจากนี้ใช้โทนหมึกกลาง ๆ เพื่อไม่ให้เกิดสีที่มีความหมายกำกวม
 */
const CODE_BADGE_CLASS: Record<string, string> = {
  S: "bg-ku text-white",
  G: "bg-blue text-white",
  P: "bg-violet text-white",
};

export function roomTypeCodeBadge(code: string): string {
  return CODE_BADGE_CLASS[code] ?? "bg-ink text-white";
}

/** ระยะเวลาเป็นนาที พร้อมหน่วย */
export function formatMinutes(minutes: number): string {
  return `${minutes} นาที`;
}

/** วันที่/เวลาแบบไทย เขตเวลาไทย (ระบบคิดเวลา Asia/Bangkok) */
export function formatThaiDateTime(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(date);
}
