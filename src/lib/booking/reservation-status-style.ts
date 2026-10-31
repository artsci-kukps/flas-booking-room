import type { ReservationStatus } from "./reservation-status";

/**
 * โทนสีของป้ายสถานะการจอง — แหล่งความจริงเดียวที่ทั้งฝั่งผู้ใช้และแอดมินใช้ร่วมกัน
 * ชื่อสถานะมาจาก RESERVATION_STATUS_LABEL (อย่านิยามซ้ำที่นี่)
 *
 * สีทั้งหมดอ้างจากโทเคนใน globals.css เท่านั้น (Named-Not-Shaded)
 * ตาม DESIGN.md: เขียว = ว่าง/พร้อมใช้, เหลืองอำพัน = ถูกใช้/ไม่ว่าง, เทา = เป็นกลาง
 * PENDING (จองแล้ว) และ ACTIVE (กำลังใช้งาน) ต่างก็ "ครอง" ช่วงเวลาอยู่ → เหลืองอำพัน
 * LATE_RETURN เป็นความผิดปกติระดับเตือน (ไม่ใช่ error) → เหลืองอำพันพร้อมเส้นขอบ
 */
export const RESERVATION_STATUS_CLASS: Record<ReservationStatus, string> = {
  PENDING: "bg-amber-soft text-amber-ink",
  ACTIVE: "bg-amber-soft text-amber-ink",
  COMPLETED: "bg-canvas text-ink-muted",
  LATE_RETURN: "border border-border bg-amber-soft text-amber-ink",
  CANCELLED: "bg-canvas text-ink-muted",
  NO_SHOW: "bg-canvas text-ink-muted",
};
