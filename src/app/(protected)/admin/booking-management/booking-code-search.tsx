import Alert from "@/components/alert";
import RoomTypeCodeBadge from "@/components/room-type-code-badge";
import type { AdminBookingRow } from "@/lib/admin/booking-admin";
import { formatBangkokTime, formatThaiDate } from "@/lib/format";

import BookingRowActions from "./booking-row-actions";
import StatusBadge from "./status-badge";

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
    <div className="mt-4 border-t border-border pt-4" aria-live="polite">
      <h3 className="sr-only">ผลการค้นรหัส</h3>

      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <p className="text-xs font-semibold text-ink-muted">รหัสการจอง</p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-[0.25em] text-ink">
            {booking.bookingCode}
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-start gap-x-3 gap-y-2">
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

      <BookingRowActions row={booking} className="mt-4 justify-end" />
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
 *
 * ป้าย "วันนี้" ย้ำขอบเขตให้ชัด เพราะตัวเลือกวันด้านล่างใช้กับรายการจอง/ตารางห้อง
 * ไม่ใช่ขอบเขตของช่องค้นนี้
 */
export default function BookingCodeSearch({ date, today, state }: BookingCodeSearchProps) {
  return (
    <section className="panel mt-6 p-4 sm:p-5" aria-labelledby="code-search-heading">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h2 id="code-search-heading" className="text-base font-semibold tracking-tight text-ink">
            ค้นรหัสการจอง
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-muted">
            ผู้ใช้แจ้งรหัส 6 หลักที่จุดรับกุญแจ — ค้นได้เฉพาะการจองของวันนี้
          </p>
        </div>
        <span className="inline-flex items-center rounded-full border border-border bg-canvas px-3 py-1 text-xs font-semibold text-ink-muted">
          วันนี้ · {formatThaiDate(today)}
        </span>
      </div>

      <form
        action="/admin/booking-management"
        method="get"
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <input type="hidden" name="date" value={date} />
        <div className="w-full sm:max-w-56">
          <label htmlFor="booking-code" className="field-label">
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
            className="field h-11 w-full text-base tabular-nums tracking-[0.25em]"
          />
        </div>
        <button type="submit" className="btn btn-primary h-11 w-full sm:w-auto">
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
