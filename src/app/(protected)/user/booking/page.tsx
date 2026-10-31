import Link from "next/link";

import { requireUser } from "@/lib/auth/guards";
import { todayInBangkok } from "@/lib/admin/service-periods";
import {
  parseBookingDate,
  parseBookingRoomId,
} from "@/lib/booking/booking-date";
import { BLOCK_LENGTH_COPY } from "@/lib/booking/slot-display";

import BookingFlow from "@/components/booking/booking-flow";

import { bookRoom } from "./actions";

/** ชื่อแสดงบนหัวหน้า: เอาชื่อจริง (โทเคนแรก) ถ้ามี ไม่งั้นใช้หน้าอีเมล */
function displayName(fullName: string | null, email: string): string {
  const name = fullName?.trim();
  if (name) return name.split(/\s+/)[0]!;
  return email.split("@")[0]!;
}

/** ไอคอนเส้น 1.8 ตามระบบ — ใช้เฉพาะในแถบข้อมูลสั้น ๆ ใต้หัวข้อ */
function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M3 10h18" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7.5 8.5 6 8.5-6" />
    </svg>
  );
}

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const name = displayName(user.fullName, user.email);

  const params = await searchParams;
  const today = todayInBangkok();
  const date = parseBookingDate(params.date);
  const roomId = parseBookingRoomId(params.room);

  return (
    <main className="page py-8 sm:py-10">
      <header className="max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
              จองห้อง
            </h1>
            <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
              สวัสดี, {name} — เลือกห้องที่ต้องการ
              แล้วเลือกวันและช่วงเวลาในหน้าต่างที่เปิดขึ้น
            </p>
          </div>

          <Link href="/user/table" className="btn btn-outline btn-sm shrink-0">
            ดูตารางจอง
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
          </Link>
        </div>

        {/* กติกาสั้น ๆ ที่ต้องรู้ก่อนเลือกห้อง — อยู่ในบรรทัดเดียว ไม่แย่งความสนใจจากผนังห้อง */}
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4 text-[0.8125rem] font-medium text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <CalendarIcon />
            จองได้วันนี้และวันพรุ่งนี้
          </span>
          <span aria-hidden="true" className="hidden h-3 w-px bg-border sm:block" />
          <span className="inline-flex items-center gap-1.5">
            <MailIcon />
            รับรหัส 6 หลักทางอีเมลเพื่อรับกุญแจ
          </span>
        </div>

        <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-muted">
          {BLOCK_LENGTH_COPY}
        </p>
      </header>

      <BookingFlow
        today={today}
        date={date}
        roomId={roomId}
        bookRoomAction={bookRoom}
      />

      <p className="mt-8 text-[0.8125rem] text-ink-muted">
        ต้องการดูรหัสหรือยกเลิกการจอง? ไปที่{" "}
        <Link
          href="/user/history"
          className="font-semibold text-ku underline-offset-4 hover:underline"
        >
          ประวัติการจอง
        </Link>
      </p>
    </main>
  );
}
