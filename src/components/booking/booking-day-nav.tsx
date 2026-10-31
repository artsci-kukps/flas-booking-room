import Link from "next/link";

import {
  bookingDateOptions,
  shiftBookingDate,
  thaiWeekday,
} from "@/lib/booking/booking-date";
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
  /**
   * "window" = เลือกได้เฉพาะวันนี้/วันพรุ่งนี้ (หน้าจองของผู้ใช้)
   * "all" = เดินวันไปมา/เลือกวันใดก็ได้ (หน้าแอดมินที่ต้องดูย้อนหลัง)
   */
  variant?: "window" | "all";
  /** ระยะห่างจากบล็อกก่อนหน้า — หน้าแอดมินใช้ mt-6 เพื่อแยกจากช่องค้นรหัส */
  className?: string;
};

/** ลูกศรเดินวัน — เส้น 1.8 ตามระบบไอคอนของโปรเจกต์ */
function Chevron({ direction }: { direction: "left" | "right" }) {
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
      {direction === "left" ? (
        <path d="m15 18-6-6 6-6" />
      ) : (
        <path d="m9 18 6-6-6-6" />
      )}
    </svg>
  );
}

export default function BookingDayNav({
  path,
  date,
  today,
  variant = "all",
  className = "mt-4",
}: BookingDayNavProps) {
  const hrefFor = (target: string): string => `${path}?date=${target}`;

  // หน้าผู้ใช้: ตัวเลือกวันยึดหน้าต่างการจอง (วันนี้/วันพรุ่งนี้) ตามกติกาของ popup จอง
  if (variant === "window") {
    return (
      <nav aria-label="เลือกวันที่ของตาราง" className={`panel w-full p-1.5 sm:w-fit ${className}`}>
        <div className="flex gap-1.5">
          {bookingDateOptions(today).map((option) => {
            const active = option.date === date;

            return (
              <Link
                key={option.date}
                href={hrefFor(option.date)}
                aria-current={active ? "date" : undefined}
                className={`flex min-h-[3.25rem] flex-1 flex-col items-center justify-center rounded-[10px] px-3 py-2 text-center transition-colors sm:min-w-[10.5rem] sm:flex-none ${
                  active ? "bg-ku-soft" : "hover:bg-canvas"
                }`}
              >
                <span
                  className={`text-sm font-semibold ${
                    active ? "text-ku" : "text-ink"
                  }`}
                >
                  {option.label}
                </span>
                <span
                  className={`mt-0.5 text-xs tabular-nums ${
                    active ? "text-ku" : "text-ink-muted"
                  }`}
                >
                  {option.formatted} · {option.weekday}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <nav
      aria-label="เลือกวันที่ของตาราง"
      className={`panel flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      {/* วันที่เป็นพระเอกของการ์ด — ลูกศรขนาบสองข้างให้เดินวันไปมาได้เร็ว */}
      <div className="flex items-center gap-0.5">
        <Link
          href={hrefFor(shiftBookingDate(date, -1))}
          className="icon-btn h-10 w-10 shrink-0"
          aria-label="ดูวันก่อนหน้า"
        >
          <Chevron direction="left" />
        </Link>

        <div className="min-w-0 px-2">
          <p className="text-[0.9375rem] font-semibold text-ink">
            {formatThaiDate(date)}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">วัน{thaiWeekday(date)}</p>
        </div>

        <Link
          href={hrefFor(shiftBookingDate(date, 1))}
          className="icon-btn h-10 w-10 shrink-0"
          aria-label="ดูวันถัดไป"
        >
          <Chevron direction="right" />
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {date === today ? (
          <span className="inline-flex h-9 items-center rounded-full bg-ku-soft px-3 text-xs font-semibold text-ku">
            วันนี้
          </span>
        ) : (
          <Link href={hrefFor(today)} className="btn btn-outline btn-sm">
            กลับมาวันนี้
          </Link>
        )}

        <form action={path} method="get" className="flex items-center gap-1.5">
          <label className="sr-only" htmlFor="booking-day-nav-date">
            เลือกวันที่
          </label>
          <input
            id="booking-day-nav-date"
            name="date"
            type="date"
            className="field h-9 w-[9.25rem] text-sm"
            defaultValue={date}
          />
          <button
            type="submit"
            className="btn btn-ghost btn-sm"
            aria-label="ไปยังวันที่เลือก"
          >
            ไป
          </button>
        </form>
      </div>
    </nav>
  );
}
