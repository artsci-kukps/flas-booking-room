import Link from "next/link";

import RoomTypeCodeBadge from "@/components/room-type-code-badge";
import { thaiWeekday } from "@/lib/booking/booking-date";
import type { MyBooking } from "@/lib/booking/my-bookings";
import { RESERVATION_STATUS_LABEL } from "@/lib/booking/reservation-status";
import { RESERVATION_STATUS_CLASS } from "@/lib/booking/reservation-status-style";
import { formatBangkokTime, formatThaiDate, formatThaiDateTime } from "@/lib/format";

import CancelBookingButton from "./cancel-booking-button";

/**
 * เนื้อหาหน้าการจองของฉัน — แยกจาก page เพื่อให้เห็นภาพรวมสถานะและเทสต์ได้
 * โดยไม่ต้องแตะฐานข้อมูล
 *
 * จัดกลุ่มตาม "ยังดำเนินอยู่" (PENDING/ACTIVE) กับ "ที่ผ่านมา" เพื่อให้หารหัส
 * สำหรับรับกุญแจเจอทันที ส่วนรายการที่จบแล้วเรียงจากใหม่ไปเก่าเหมือนคำสั่งของ DB
 */

/** สถานะที่ยังต้องติดตามผล — รอรับกุญแจหรือกำลังใช้งานอยู่ */
const CURRENT_STATUSES = new Set<MyBooking["status"]>(["PENDING", "ACTIVE"]);

/** สถานะที่ใช้โทนเหลืองอำพัน (ครองช่วงเวลาหรือคืนกุญแจช้า) */
function isAmberStatus(status: MyBooking["status"]) {
  return status === "PENDING" || status === "ACTIVE" || status === "LATE_RETURN";
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M3 10h18" />
    </svg>
  );
}

/**
 * ป้ายสถานะบนพื้นขาว: เติมสีตามความหมาย + จุดนำสายตา
 * สถานะที่จบแล้วใช้พื้น canvas พร้อมเส้นขอบ เพื่อให้ยังเห็นรูปแคปซูลบนการ์ดขาว
 */
function StatusChip({ status }: { status: MyBooking["status"] }) {
  const amber = isAmberStatus(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${RESERVATION_STATUS_CLASS[status]}${amber ? "" : " border border-border"}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${amber ? "bg-amber" : "bg-ink-muted"}`}
      />
      {RESERVATION_STATUS_LABEL[status]}
    </span>
  );
}

function BookingCard({ booking }: { booking: MyBooking }) {
  const showCancelBlocked =
    !booking.canCancel &&
    booking.cancelBlockedMessage !== null &&
    (booking.status === "PENDING" || booking.status === "ACTIVE");

  return (
    <li className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <RoomTypeCodeBadge code={booking.roomTypeCode} />
            <p className="text-base font-semibold text-ink">{booking.roomName}</p>
          </div>

          <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm text-ink-muted">
            <span>
              {thaiWeekday(booking.bookingDate)} {formatThaiDate(booking.bookingDate)} ·
            </span>
            <span className="font-semibold tabular-nums text-ink">
              {formatBangkokTime(booking.startTime)}–{formatBangkokTime(booking.endTime)} น.
            </span>
          </p>

          <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-xs text-ink-muted">รหัสการจอง</span>
            <span className="text-lg font-semibold tabular-nums tracking-[0.14em] text-ink">
              {booking.bookingCode}
            </span>
          </p>
        </div>

        <div className="ml-auto flex flex-col items-end gap-1 text-right">
          <StatusChip status={booking.status} />
          {booking.status === "CANCELLED" && booking.canceledAt ? (
            <p className="text-xs text-ink-muted">
              ยกเลิกเมื่อ {formatThaiDateTime(booking.canceledAt)}
            </p>
          ) : null}
        </div>
      </div>

      {booking.canCancel ? (
        <div className="mt-4 border-t border-border pt-4">
          <CancelBookingButton bookingId={booking.id} />
        </div>
      ) : showCancelBlocked ? (
        <p className="mt-4 border-t border-border pt-4 text-sm leading-relaxed text-ink-muted">
          {booking.cancelBlockedMessage}
        </p>
      ) : null}
    </li>
  );
}

function BookingGroup({
  id,
  title,
  bookings,
}: {
  id: string;
  title: string;
  bookings: MyBooking[];
}) {
  return (
    <section aria-labelledby={id}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={id} className="text-base font-semibold tracking-tight text-ink">
          {title}
        </h2>
        <p className="text-xs tabular-nums text-ink-muted">{`${bookings.length} รายการ`}</p>
      </div>

      <ul className="mt-3 grid gap-3">
        {bookings.map((booking) => (
          <BookingCard key={booking.id} booking={booking} />
        ))}
      </ul>
    </section>
  );
}

export default function BookingHistory({ bookings }: { bookings: MyBooking[] }) {
  const current = bookings
    .filter((booking) => CURRENT_STATUSES.has(booking.status))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  const past = bookings
    .filter((booking) => !CURRENT_STATUSES.has(booking.status))
    .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

  return (
    <main className="page py-8 sm:py-10">
      <div className="max-w-3xl">
        <header className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 sm:flex-1">
            <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
              การจองของฉัน
            </h1>
            <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
              รายการจองทั้งหมดของคุณ พร้อมรหัส 6 หลักและสถานะ —
              ยกเลิกเองได้เฉพาะก่อนถึงเวลาเริ่มและยังไม่ได้รับกุญแจ
            </p>
          </div>

          {bookings.length > 0 ? (
            <Link href="/user/booking" className="btn btn-outline btn-sm shrink-0">
              จองห้อง
              <ArrowIcon />
            </Link>
          ) : null}
        </header>

        {bookings.length === 0 ? (
          <section className="panel mt-8 px-6 py-12 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ku-soft text-ku">
              <CalendarIcon />
            </span>
            <h2 className="mt-4 text-base font-semibold text-ink">ยังไม่มีการจอง</h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-ink-muted">
              เมื่อจองห้องสำเร็จ รายการจะแสดงที่นี่พร้อมรหัส 6 หลักและสถานะ
            </p>
            <Link href="/user/booking" className="btn btn-primary mt-5">
              ไปหน้าจองห้อง
            </Link>
          </section>
        ) : (
          <div className="mt-8 space-y-8">
            {current.length > 0 ? (
              <BookingGroup id="current-bookings" title="กำลังดำเนินการ" bookings={current} />
            ) : null}
            {past.length > 0 ? (
              <BookingGroup id="past-bookings" title="ที่ผ่านมา" bookings={past} />
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
