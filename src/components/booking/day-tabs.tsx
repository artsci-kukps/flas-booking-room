import Link from "next/link";

import { bookingRoomHref, type BookingDateOption } from "@/lib/booking/booking-date";

/**
 * แท็บสลับวันในขั้นเลือกเวลา (ticket #17) — มีเพียง "วันนี้" และ "วันพรุ่งนี้"
 * สลับวันโดยคงห้องที่เลือกไว้ (?date=&room=) จึงไม่หลุดกลับไปขั้นเลือกห้อง
 */

type DayTabsProps = {
  basePath: string;
  roomId: string;
  options: BookingDateOption[];
  /** วันที่กำลังแสดงอยู่ */
  active: string;
};

export default function DayTabs({ basePath, roomId, options, active }: DayTabsProps) {
  return (
    <div className="panel mt-6 flex flex-wrap items-center gap-2 p-3">
      <span className="px-2 text-xs font-semibold text-ink-muted">เลือกวัน</span>

      {options.map((option) => {
        const isActive = option.date === active;

        return (
          <Link
            key={option.date}
            href={bookingRoomHref(basePath, roomId, option.date)}
            aria-current={isActive ? "page" : undefined}
            className={`btn btn-sm ${isActive ? "btn-primary" : "btn-outline"}`}
          >
            {option.label}
            <span className="tabular-nums text-xs font-normal opacity-90">
              {option.formatted}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
