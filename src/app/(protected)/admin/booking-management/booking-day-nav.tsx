import Link from "next/link";

import { shiftBookingDate } from "@/lib/booking/day-availability";
import { formatThaiDate } from "@/lib/format";

const PATH = "/admin/booking-management";

function hrefFor(date: string): string {
  return `${PATH}?date=${date}`;
}

type BookingDayNavProps = {
  /** วันที่กำลังดู (YYYY-MM-DD) */
  date: string;
  /** วันปัจจุบันในเขตไทย — ปุ่ม "วันนี้" */
  today: string;
};

/**
 * ตัวเลือกวันของตารางจองฝั่งแอดมิน — ปุ่มก่อน/ถัดไป ช่องเลือกวัน และกลับมาวันนี้
 * นำทางด้วยพารามิเตอร์ ?date=YYYY-MM-DD เพื่อให้ server อ่านวันที่เดียวกันไปดึงตาราง
 */
export default function BookingDayNav({ date, today }: BookingDayNavProps) {
  return (
    <div className="panel mt-4 flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-ink-muted">วันที่แสดงตาราง</p>
        <p className="mt-0.5 text-base font-semibold text-ink">{formatThaiDate(date)}</p>
      </div>

      <Link
        href={hrefFor(shiftBookingDate(date, -1))}
        className="btn btn-outline btn-sm"
        aria-label="ดูวันก่อนหน้า"
      >
        <span aria-hidden="true">‹</span> วันก่อนหน้า
      </Link>

      <form action={PATH} method="get" className="flex items-center gap-2">
        <label className="sr-only" htmlFor="booking-day-nav-date">
          เลือกวันที่
        </label>
        <input
          id="booking-day-nav-date"
          name="date"
          type="date"
          className="field h-9 w-40 text-sm"
          defaultValue={date}
        />
        <button type="submit" className="btn btn-outline btn-sm">
          ไปวันนี้
        </button>
      </form>

      {date === today ? (
        <span className="text-sm font-medium text-ku">วันนี้</span>
      ) : (
        <Link href={hrefFor(today)} className="btn btn-outline btn-sm">
          กลับมาวันนี้
        </Link>
      )}

      <Link
        href={hrefFor(shiftBookingDate(date, 1))}
        className="btn btn-outline btn-sm"
        aria-label="ดูวันถัดไป"
      >
        วันถัดไป <span aria-hidden="true">›</span>
      </Link>
    </div>
  );
}
