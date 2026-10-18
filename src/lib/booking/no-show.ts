import type { Reservation } from '@/db/schema'

/**
 * กฎ NO_SHOW อัตโนมัติ (TOR ข้อ 7)
 *
 *   ถ้ายังเป็น PENDING และเวลาผ่านไปเกิน start_time + 30 นาที → NO_SHOW
 *
 * ตัวกฎจริงรันในฐานข้อมูลผ่าน `pg_cron` (ดู drizzle/0002_no_show_cron.sql และ
 * docs/pg-cron-schedules.md) — โมดูลนี้คือ "spec ที่รันได้" ของ predicate นั้น
 * เพื่อให้ทดสอบกติกาและขอบเขตเวลา (รวมเที่ยงคืน Asia/Bangkok) ได้โดยไม่ต้องมี DB
 *
 * เกณฑ์ตัดสินเป็น instant ล้วน: cutoff = start_time + 30 นาที แล้วเทียบกับ now
 * จึงไม่ขึ้นกับ timezone ของเซิร์ฟเวอร์ และไม่ใช้ปฏิทินวัน (ไม่พังเมื่อข้ามเที่ยงคืน)
 */

/** ระยะผ่อนผันก่อนถือว่าไม่มารับกุญแจ (นาที) — ต้องตรงกับ SQL */
export const NO_SHOW_GRACE_MINUTES = 30

/** สถานะการจอง (mirror ค่าจาก enum reservation_status) */
export type ReservationStatus = Reservation['status']

/** ข้อมูลต่ำสุดที่กฎ NO_SHOW ต้องใช้ */
export type NoShowCandidate = {
  status: ReservationStatus
  startTime: Date
}

/**
 * เส้นตัดเวลาของการจองหนึ่งรายการ = start_time + 30 นาที
 * คืน Date ใหม่เสมอ (ไม่แก้ไขค่าที่รับมา)
 */
export function noShowCutoff(startTime: Date): Date {
  return new Date(startTime.getTime() + NO_SHOW_GRACE_MINUTES * 60 * 1000)
}

/**
 * รายการนี้ควรถูกตั้งเป็น NO_SHOW หรือยัง
 * - ต้องเป็น PENDING เท่านั้น (ACTIVE/COMPLETED/LATE_RETURN/CANCELLED/NO_SHOW ไม่ถูกแตะ)
 * - now ต้องถึงหรือเลยเส้นตัด (now >= start_time + 30 นาที)
 */
export function isNoShowCandidate(candidate: NoShowCandidate, now: Date): boolean {
  return candidate.status === 'PENDING' && now.getTime() >= noShowCutoff(candidate.startTime).getTime()
}

/**
 * เลือกทุกรายการที่ต้องตั้งเป็น NO_SHOW ณ เวลา now (เรียงตามลำดับเดิม)
 * ใช้คู่กับ UPDATE ... WHERE status = 'PENDING' AND start_time + interval '30 minutes' <= now()
 * ในฝั่ง DB
 */
export function selectNoShowReservations<T extends NoShowCandidate>(
  rows: readonly T[],
  now: Date,
): T[] {
  return rows.filter((row) => isNoShowCandidate(row, now))
}
