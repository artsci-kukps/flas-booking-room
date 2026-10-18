import type { Reservation } from "@/db/schema";

/**
 * สถานะการจองและตัวตรวจค่า — โมดูลบริสุทธิ์ที่นำเข้าได้ทั้งฝั่ง server และ client
 * (import type ถูกตัดออกตอน build จึงไม่ดึง drizzle/การเชื่อมต่อฐานข้อมูลเข้า client)
 */

/** สถานะการจองทั้งหมดตามวงจรชีวิต (TOR ข้อ 7) */
export const RESERVATION_STATUSES = [
  "PENDING",
  "ACTIVE",
  "COMPLETED",
  "LATE_RETURN",
  "CANCELLED",
  "NO_SHOW",
] as const satisfies readonly Reservation["status"][];

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/**
 * ป้ายชื่อภาษาไทยของแต่ละสถานะ — แหล่งความจริงเดียวที่ทุกหน้า (ผู้ใช้/แอดมิน) ใช้ร่วมกัน
 * ถ้อยคำสอดคล้องกับ StatusLegendSection เพื่อให้ศัพท์เดียวกันทั้งระบบ
 */
export const RESERVATION_STATUS_LABEL: Record<ReservationStatus, string> = {
  PENDING: "จองแล้ว รอรับกุญแจ",
  ACTIVE: "กำลังใช้งาน",
  COMPLETED: "เสร็จสิ้น",
  LATE_RETURN: "คืนกุญแจช้า",
  CANCELLED: "ยกเลิกแล้ว",
  NO_SHOW: "ไม่มาแสดงตัว",
};

/** ตรวจว่าค่าที่รับมา (จากฟอร์มเป็น string) เป็นสถานะที่รู้จักหรือไม่ */
export function isReservationStatus(value: string): value is ReservationStatus {
  return (RESERVATION_STATUSES as readonly string[]).includes(value);
}
