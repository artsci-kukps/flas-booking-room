import {
  RESERVATION_STATUS_LABEL,
  type ReservationStatus,
} from "@/lib/booking/reservation-status";

import { BOOKING_STATUS_CLASS } from "./booking-status";

/** สถานะที่ใช้โทนเหลืองอำพัน — ยังครองช่วงเวลาหรือคืนกุญแจช้า */
function isAmberStatus(status: ReservationStatus) {
  return status === "PENDING" || status === "ACTIVE" || status === "LATE_RETURN";
}

/**
 * ป้ายสถานะการจอง — จุดเดียวที่ประกอบสี (BOOKING_STATUS_CLASS) กับชื่อสถานะ
 * (RESERVATION_STATUS_LABEL) เข้าด้วยกัน ใช้ร่วมกันระหว่างตารางการจองและผลการค้นรหัส
 *
 * เติมจุดนำสายตาให้สแกนแถวได้เร็ว และใส่เส้นขอบให้สถานะที่จบแล้ว
 * เพื่อให้ยังเห็นรูปแคปซูลบนพื้นการ์ดขาว
 */
export default function StatusBadge({ status }: { status: ReservationStatus }) {
  const amber = isAmberStatus(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${BOOKING_STATUS_CLASS[status]}${amber ? "" : " border border-border"}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${amber ? "bg-amber" : "bg-ink-muted"}`}
      />
      {RESERVATION_STATUS_LABEL[status]}
    </span>
  );
}
