import Link from "next/link";

import { shiftBookingDate } from "@/lib/booking/day-availability";
import { formatThaiDate } from "@/lib/format";

/**
 * ตัวเลือกวันของตารางการจอง — ใช้ร่วมกันทุกหน้าที่มีตารางรายวัน
 * (หน้าตารางจองของผู้ใช้/แอดมิน และศูนย์จัดการจอง, ticket #20)
 * นำทางด้วยพารามิเตอร์ ?date=YYYY-MM-DD ของหน้าตัวเอง (`path`) เพื่อให้ server
 * อ่านวันที่เดียวกันไปดึงตาราง/รายการจอง
 */

type BookingDayNavProps = {
  /** เส้นทางหน้าที่มีตาราง — ลิงก์วันทั้งหมดชี้ไปหน้านี้ (?date=YYYY-MM-DD) */
  path: string;
  /** วันที่กำลังดู (YYYY-MM-DD) */
  date: string;
  /** วันปัจจุบันในเขตเวลาไทย — ปุ่ม "วันนี้" */
  today: string;
};

export default function BookingDayNav({ path, date, today }: BookingDayNavProps) {
  const hrefFor = (target: string): string => `${path}?date=${target}`;

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

      <form action={path} method="get" className="flex items-center gap-2">
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
