import type { ReservationStatus } from "@/lib/admin/booking-admin";

/**
 * ป้ายและสีของสถานะการจอง — ใช้ร่วมกันระหว่างตารางการจองและผลการค้นรหัส
 * (สอดคล้องกับ StatusLegendSection ที่อธิบายความหมายของทั้ง 6 สถานะ)
 * สีทั้งหมดอ้างจากโทเคนใน globals.css เท่านั้น (Named-Not-Shaded)
 */
export const BOOKING_STATUS_LABEL: Record<ReservationStatus, string> = {
  PENDING: "รอรับกุญแจ",
  ACTIVE: "กำลังใช้งาน",
  COMPLETED: "เสร็จสิ้น",
  LATE_RETURN: "คืนช้า",
  CANCELLED: "ยกเลิกแล้ว",
  NO_SHOW: "ไม่มาแสดงตัว",
};

export const BOOKING_STATUS_CLASS: Record<ReservationStatus, string> = {
  PENDING: "bg-amber-soft text-amber-ink",
  ACTIVE: "bg-ku-soft text-ku",
  COMPLETED: "bg-canvas text-ink-muted",
  LATE_RETURN: "bg-danger-soft text-danger",
  CANCELLED: "bg-canvas text-ink-muted",
  NO_SHOW: "bg-canvas text-ink-muted",
};
