import Alert from "@/components/alert";
import RoomTypeCodeBadge from "@/components/room-type-code-badge";
import type { AdminBookingRow } from "@/lib/admin/booking-admin";
import { formatBangkokTime, formatThaiDate } from "@/lib/format";

import BookingRowActions from "./booking-row-actions";
import { BOOKING_STATUS_CLASS, BOOKING_STATUS_LABEL } from "./booking-status";

/**
 * สถานะของผลการค้นรหัส — คำนวณฝั่งหน้าเพจแล้วส่งเข้ามาให้แสดงผล
 * "found" มีการจองจริงของวันนี้, "not-found" ไม่มีรหัสนี้ในวันนี้, "invalid" รูปแบบรหัสผิด
 */
export type CodeSearchState =
  | { kind: "idle" }
  | { kind: "invalid" }
  | { kind: "not-found"; code: string }
  | { kind: "found"; booking: AdminBookingRow };

function FoundCard({ booking }: { booking: AdminBookingRow }) {
  return (
    <div className="mt-4 rounded-[14px] border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-2xl font-semibold tabular-nums tracking-[0.25em] text-ink">
          {booking.bookingCode}
        </p>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${BOOKING_STATUS_CLASS[booking.status]}`}
        >
          {BOOKING_STATUS_LABEL[booking.status]}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <RoomTypeCodeBadge code={booking.roomTypeCode} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">
            {booking.bookerName}
            <span className="ml-2 font-normal text-ink-muted">{booking.bookerEmail}</span>
          </p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {booking.roomName} · {formatBangkokTime(booking.startTime)}
            {"–"}
            {formatBangkokTime(booking.endTime)} น.
          </p>
        </div>
      </div>

      <BookingRowActions row={booking} className="mt-4" />
    </div>
  );
}

type BookingCodeSearchProps = {
  /** วันที่กำลังดูในตาราง — ส่งต่อไปกับฟอร์มเพื่อคงวันเดิมหลังค้น */
  date: string;
  /** วันปัจจุบันในเขตไทย — ขอบเขตการค้นรหัส (TOR ข้อ 6.3) */
  today: string;
  state: CodeSearchState;
};

/**
 * ช่องค้นรหัสการจอง 6 หลัก + ผลการค้น (TOR ข้อ 6.3 · ticket #11 AC 2)
 * การค้นจำกัดที่วันปัจจุบันเท่านั้น — รหัสของวันอื่นจะไม่ถูกเปิดเผย
 * เป็นฟอร์ม GET ธรรมดา ใช้ได้แม้ไม่มี JavaScript
 */
export default function BookingCodeSearch({ date, today, state }: BookingCodeSearchProps) {
  return (
    <section className="panel mt-6 p-4 sm:p-5" aria-labelledby="code-search-heading">
      <h2 id="code-search-heading" className="text-base font-semibold tracking-tight text-ink">
        ค้นรหัสการจอง
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-muted">
        ผู้ใช้แจ้งรหัส 6 หลักที่จุดรับกุญแจ — ค้นได้เฉพาะรหัสของวันนี้ (
        {formatThaiDate(today)}) เท่านั้น
      </p>

      <form
        action="/admin/booking-management"
        method="get"
        className="mt-3 flex flex-wrap items-end gap-2"
      >
        <input type="hidden" name="date" value={date} />
        <div className="min-w-0 flex-1">
          <label htmlFor="booking-code" className="sr-only">
            รหัสการจอง 6 หลัก
          </label>
          <input
            id="booking-code"
            name="code"
            inputMode="numeric"
            autoComplete="off"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            placeholder="000000"
            className="field h-10 w-full max-w-40 text-base tabular-nums tracking-[0.25em]"
          />
        </div>
        <button type="submit" className="btn btn-primary">
          ค้นหา
        </button>
      </form>

      {state.kind === "invalid" ? (
        <Alert
          tone="danger"
          heading="รหัสการจองต้องเป็นตัวเลข 6 หลัก"
          body="กรุณาตรวจสอบรหัสที่ผู้ใช้แจ้งแล้วลองใหม่"
          className="mt-4"
        />
      ) : null}

      {state.kind === "not-found" ? (
        <Alert
          tone="warning"
          heading={`ไม่พบรหัส ${state.code} ในวันนี้`}
          body="รหัสอาจเป็นของวันอื่น หรือผู้ใช้แจ้งรหัสผิด — การค้นจำกัดเฉพาะการจองของวันนี้"
          className="mt-4"
        />
      ) : null}

      {state.kind === "found" ? <FoundCard booking={state.booking} /> : null}
    </section>
  );
}
