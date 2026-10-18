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

/** ตรวจว่าค่าที่รับมา (จากฟอร์มเป็น string) เป็นสถานะที่รู้จักหรือไม่ */
export function isReservationStatus(value: string): value is ReservationStatus {
  return (RESERVATION_STATUSES as readonly string[]).includes(value);
}
