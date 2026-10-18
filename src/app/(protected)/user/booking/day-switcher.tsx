import Link from "next/link";

import { shiftBookingDate } from "@/lib/booking/day-availability";
import { formatThaiDate } from "@/lib/format";

/**
 * ตัวเปลี่ยนวันดูของหน้าผู้ใช้ — ย้ายวันด้วยปุ่ม "วันก่อนหน้า / วันถัดไป"
 * หรือเลือกวันที่เองจากช่อง date ทั้งหมดนำทางด้วยพารามิเตอร์ ?date=YYYY-MM-DD
 * เพื่อให้หน้าฝั่ง server อ่านวันที่เดียวกันไปคำนวณช่องว่าง (ดู page.tsx)
 *
 * เป็น server component ที่ไม่พึ่ง JavaScript: ปุ่มย้ายวันเป็น <Link> (ไป client-side)
 * และช่องเลือกวันเป็น <form method="get"> (ส่ง ?date= ได้แม้สคริปต์ไม่ทำงาน)
 * จึงใช้ shiftBookingDate() ตัวเดียวกับฝั่ง server โดยไม่ต้องดึงโค้ดไปฝั่ง client
 */
const PATH = "/user/booking";

function hrefFor(date: string): string {
  return `${PATH}?date=${date}`;
}

export default function DaySwitcher({ date }: { date: string }) {
  return (
    <div className="panel mt-6 flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-ink-muted">วันที่เลือก</p>
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
        <label className="sr-only" htmlFor="day-switcher-date">
          เลือกวันที่
        </label>
        <input
          id="day-switcher-date"
          name="date"
          type="date"
          className="field h-9 w-40 text-sm"
          defaultValue={date}
        />
        <button type="submit" className="btn btn-outline btn-sm">
          ไปวันนี้
        </button>
      </form>

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
