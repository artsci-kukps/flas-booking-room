import RoomTypeCodeBadge from "@/components/room-type-code-badge";
import type { AdminBookingRow } from "@/lib/admin/booking-admin";
import { formatBangkokTime } from "@/lib/format";

import BookingRowActions from "./booking-row-actions";
import BookingRowStatusActions from "./booking-row-status-actions";
import StatusBadge from "./status-badge";

function TimeRange({ row }: { row: AdminBookingRow }) {
  return (
    <span className="whitespace-nowrap tabular-nums text-ink">
      {formatBangkokTime(row.startTime)}
      {"–"}
      {formatBangkokTime(row.endTime)} น.
    </span>
  );
}

/** สถานะที่ยังต้องมีคนรับหรือคืนกุญแจ — ใช้แยกงานที่ต้องดูแลออกจากรายการที่จบแล้ว */
const OPEN_STATUSES = new Set<AdminBookingRow["status"]>(["PENDING", "ACTIVE"]);

/** ตารางบนจอใหญ่ + การ์ดบนจอเล็กของชุดรายการหนึ่งชุด */
function BookingRows({ rows, caption }: { rows: AdminBookingRow[]; caption: string }) {
  return (
    <>
      <div className="panel hidden overflow-x-auto xl:block">
        <table className="w-full min-w-[56rem] border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
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
                <td className="px-4 py-4 text-[0.9375rem] font-semibold tabular-nums tracking-[0.12em] text-ink">
                  {row.bookingCode}
                </td>
                <td className="px-4 py-4 text-sm text-ink">
                  <p className="font-medium">{row.bookerName}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{row.bookerEmail}</p>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <RoomTypeCodeBadge code={row.roomTypeCode} />
                    <span className="whitespace-nowrap text-sm font-medium text-ink">
                      {row.roomName}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm">
                  <TimeRange row={row} />
                </td>
                <td className="px-4 py-4">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-4 py-4">
                  <div className="flex min-w-[10.5rem] flex-col items-end gap-2">
                    <BookingRowActions row={row} className="justify-end" />
                    <BookingRowStatusActions row={row} className="justify-end" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="grid gap-3 xl:hidden">
        {rows.map((row) => (
          <li key={row.id} className="panel p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-semibold tabular-nums tracking-[0.12em] text-ink">
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

            <div className="mt-3 border-t border-border pt-3">
              <BookingRowActions row={row} className="justify-end" />
              <BookingRowStatusActions row={row} className="mt-2 justify-end" />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function BookingGroup({
  id,
  title,
  description,
  rows,
}: {
  id: string;
  title: string;
  description: string;
  rows: AdminBookingRow[];
}) {
  return (
    <section aria-labelledby={id}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h3 id={id} className="text-sm font-semibold tracking-tight text-ink">
            {title}
          </h3>
          <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
        </div>
        <p className="text-xs tabular-nums text-ink-muted">{rows.length} รายการ</p>
      </div>
      <div className="mt-3">
        <BookingRows rows={rows} caption={`ตารางการจอง: ${title}`} />
      </div>
    </section>
  );
}

type BookingsTableProps = {
  rows: AdminBookingRow[];
};

/**
 * ตารางการจองของวันหนึ่ง — แยก "ต้องดำเนินการ" ขึ้นก่อนรายการที่จบแล้ว
 * เพื่อให้แอดมินเห็นงานรับ–คืนกุญแจก่อน โดยไม่ต้องกวาดสายตาผ่านรายการที่ปิดแล้ว
 * ตารางบนจอใหญ่ การ์ดบนจอเล็ก แสดงรหัส ผู้จอง ห้อง ช่วงเวลา สถานะ และปุ่มจัดการ
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

  const openRows = rows.filter((row) => OPEN_STATUSES.has(row.status));
  const closedRows = rows.filter((row) => !OPEN_STATUSES.has(row.status));

  return (
    <div className="space-y-6">
      {openRows.length > 0 ? (
        <BookingGroup
          id="open-bookings-heading"
          title="ต้องดำเนินการ"
          description="ยืนยันรับหรือคืนกุญแจจากรายการเหล่านี้"
          rows={openRows}
        />
      ) : null}

      {closedRows.length > 0 ? (
        <BookingGroup
          id="closed-bookings-heading"
          title="ปิดรายการแล้ว"
          description="รายการที่จบแล้ว — ยังแก้ไขหรือยกเลิกได้หากจำเป็น"
          rows={closedRows}
        />
      ) : null}
    </div>
  );
}
