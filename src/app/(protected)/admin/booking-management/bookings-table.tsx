import RoomTypeCodeBadge from "@/components/room-type-code-badge";
import type { AdminBookingRow } from "@/lib/admin/booking-admin";
import { formatBangkokTime } from "@/lib/format";

import BookingRowActions from "./booking-row-actions";
import BookingRowStatusActions from "./booking-row-status-actions";
import StatusBadge from "./status-badge";

function TimeRange({ row }: { row: AdminBookingRow }) {
  return (
    <span className="tabular-nums text-ink">
      {formatBangkokTime(row.startTime)}
      {"–"}
      {formatBangkokTime(row.endTime)} น.
    </span>
  );
}

type BookingsTableProps = {
  rows: AdminBookingRow[];
};

/**
 * ตารางการจองของวันหนึ่ง — ตารางบนจอใหญ่ การ์ดบนมือถือ
 * แสดงรหัส 6 หลัก ผู้จอง ห้อง ช่วงเวลา สถานะ และปุ่มรับ–คืนกุญแจ
 */
export default function BookingsTable({ rows }: BookingsTableProps) {
  if (rows.length === 0) {
    return (
      <section className="panel p-6">
        <p className="font-semibold text-ink">ไม่มีการจองในวันนี้</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          เมื่อมีผู้ใช้จองห้อง รายการจะปรากฏที่นี่พร้อมรหัส 6 หลักสำหรับยืนยันรับกุญแจ
        </p>
      </section>
    );
  }

  return (
    <>
      {/* จอใหญ่: ตาราง */}
      <div className="panel hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">ตารางการจองของวัน</caption>
          <thead>
            <tr className="border-b border-border bg-canvas">
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-ink-muted">
                รหัส
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-ink-muted">
                ผู้จอง
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-ink-muted">
                ห้อง
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-ink-muted">
                ช่วงเวลา
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-ink-muted">
                สถานะ
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-ink-muted">
                จัดการ
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id} className="align-top transition-colors hover:bg-canvas">
                <td className="px-4 py-4 text-sm font-semibold tabular-nums tracking-wider text-ink">
                  {row.bookingCode}
                </td>
                <td className="px-4 py-4 text-sm text-ink">
                  <p className="font-medium">{row.bookerName}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{row.bookerEmail}</p>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <RoomTypeCodeBadge code={row.roomTypeCode} />
                    <span className="text-sm font-medium text-ink">{row.roomName}</span>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm">
                  <TimeRange row={row} />
                </td>
                <td className="px-4 py-4">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-col items-end gap-2">
                    <BookingRowActions row={row} className="justify-end" />
                    <BookingRowStatusActions row={row} className="justify-end" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* มือถือ: การ์ด */}
      <ul className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="panel p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold tabular-nums tracking-wider text-ink">
                  {row.bookingCode}
                </p>
                <p className="mt-1 text-sm font-medium text-ink">{row.bookerName}</p>
                <p className="text-xs text-ink-muted">{row.bookerEmail}</p>
              </div>
              <StatusBadge status={row.status} />
            </div>

            <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
              <RoomTypeCodeBadge code={row.roomTypeCode} />
              <span className="text-sm font-medium text-ink">{row.roomName}</span>
            </div>
            <p className="mt-1 text-sm">
              <TimeRange row={row} />
            </p>

            <BookingRowActions row={row} className="mt-3" />
            <BookingRowStatusActions row={row} className="mt-3" />
          </li>
        ))}
      </ul>
    </>
  );
}
