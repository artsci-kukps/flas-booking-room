import {
  RESERVATION_STATUS_LABEL,
  type ReservationStatus,
} from "@/lib/booking/reservation-status";

import { BOOKING_STATUS_CLASS } from "./booking-status";

/**
 * ป้ายสถานะการจอง — จุดเดียวที่ประกอบสี (BOOKING_STATUS_CLASS) กับชื่อสถานะ
 * (RESERVATION_STATUS_LABEL) เข้าด้วยกัน ใช้ร่วมกันระหว่างตารางการจองและผลการค้นรหัส
 */
export default function StatusBadge({ status }: { status: ReservationStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${BOOKING_STATUS_CLASS[status]}`}
    >
      {RESERVATION_STATUS_LABEL[status]}
    </span>
  );
}
