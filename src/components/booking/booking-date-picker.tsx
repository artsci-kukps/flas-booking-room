import Link from "next/link";

import { bookingDateOptions } from "@/lib/booking/booking-dates";
import { formatThaiDate } from "@/lib/format";

/**
 * ตัวเลือกวันสำหรับจอง (ticket T16-1)
 * แสดงวันนี้/วันพรุ่งนี้เท่านั้นใน popup แบบไม่พึ่ง JavaScript (`<details>`/`<summary>`)
 * เพื่อให้ทั้งหน้าผู้ใช้และหน้าแอดมินใช้ตัวเดียวกัน — เลือกวันแล้วนำทางด้วย ?date=
 * ตามแพตเทิร์นเดิมของหน้า (server อ่านวันที่เดียวกันไปคำนวณช่องว่าง)
 *
 * flat ตาม DESIGN.md: ขอบ 1px ไม่มีเงา, วันนี้/พรุ่งนี้ใช้สีเน้น KU เมื่อถูกเลือก
 */

type BookingDatePickerProps = {
  /** ฐานเส้นทางของหน้าจอง เช่น /user/booking หรือ /admin/booking */
  basePath: string;
  /** วันปัจจุบันในเขตไทย (YYYY-MM-DD) */
  today: string;
  /** วันที่กำลังเลือกอยู่ (YYYY-MM-DD) */
  selected: string;
};

export default function BookingDatePicker({
  basePath,
  today,
  selected,
}: BookingDatePickerProps) {
  const options = bookingDateOptions(today);

  return (
    <section className="panel mt-6 flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-ink-muted">วันที่จอง</p>
        <p className="mt-0.5 text-base font-semibold text-ink">
          {formatThaiDate(selected)}
        </p>
      </div>

      <details className="relative">
        <summary
          className="btn btn-outline btn-sm cursor-pointer list-none select-none"
          aria-label="เปลี่ยนวันที่จอง"
        >
          เปลี่ยนวันที่
        </summary>

        <div className="absolute right-0 z-10 mt-2 w-64 rounded-panel border border-border bg-surface p-2">
          <p className="px-3 pb-1 pt-2 text-xs font-semibold text-ink-muted">
            เลือกวันที่จอง
          </p>

          {options.map((option) => {
            const active = option.date === selected;

            return (
              <Link
                key={option.date}
                href={`${basePath}?date=${option.date}`}
                aria-current={active ? "page" : undefined}
                className={`flex items-center justify-between rounded-[12px] px-3 py-2.5 text-sm font-semibold transition-colors ${
                  active ? "bg-ku-soft text-ku" : "text-ink hover:bg-canvas"
                }`}
              >
                <span>{option.label}</span>
                <span className="text-xs font-medium tabular-nums text-ink-muted">
                  {formatThaiDate(option.date)}
                </span>
              </Link>
            );
          })}

          <p className="px-3 pb-2 pt-1 text-xs leading-relaxed text-ink-muted">
            จองล่วงหน้าได้ถึงวันพรุ่งนี้เท่านั้น
          </p>
        </div>
      </details>
    </section>
  );
}