import { formatThaiDateTime } from "@/lib/format";
import type { RoomBlockRow } from "@/lib/admin/room-blocks";

import RoomBlockRowActions from "./room-block-row-actions";

type RoomBlocksTableProps = {
  rows: RoomBlockRow[];
};

/** ช่วงวันที่/เวลาแบบไทย — วันเดียวกันแสดงวันที่ครั้งเดียว: "1 มี.ค. 2569, 09:00–12:00" */
function formatRange(startTime: Date, endTime: Date): string {
  const start = formatThaiDateTime(startTime);
  const end = formatThaiDateTime(endTime);
  const startDay = start.slice(0, start.indexOf(","));
  const endDay = end.slice(0, end.indexOf(","));

  if (startDay === endDay) {
    return `${start}–${end.slice(end.indexOf(",") + 1).trim()}`;
  }

  return `${start} – ${end}`;
}

/**
 * ตารางการบล็อกห้องทั้งหมด — ตารางบนจอใหญ่ การ์ดบนมือถือ (แบบเดียวกับ users-table)
 * แสดงห้อง ช่วงเวลา เหตุผล ผู้สร้าง และปุ่มลบ (hard delete)
 */
export default function RoomBlocksTable({ rows }: RoomBlocksTableProps) {
  if (rows.length === 0) {
    return (
      <section className="panel p-6">
        <p className="font-semibold text-ink">ยังไม่มีการบล็อกห้อง</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          เพิ่มการบล็อกด้านบนเพื่อปิดห้องชั่วคราว เช่น ปิดปรับปรุงหรือเหตุจำเป็นอื่น
        </p>
      </section>
    );
  }

  return (
    <>
      {/* จอใหญ่: ตาราง */}
      <div className="panel hidden overflow-hidden md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">รายการบล็อกห้องทั้งหมด</caption>
          <thead>
            <tr className="border-b border-border bg-canvas">
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-ink-muted">
                ห้อง
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-ink-muted">
                ช่วงเวลา
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-ink-muted">
                เหตุผล
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-ink-muted">
                ผู้สร้าง
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-ink-muted">
                จัดการ
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id} className="align-top transition-colors hover:bg-canvas">
                <td className="px-4 py-4 text-sm font-semibold text-ink">{row.roomName}</td>
                <td className="px-4 py-4 text-sm tabular-nums text-ink-muted">
                  {formatRange(row.startTime, row.endTime)}
                </td>
                <td className="px-4 py-4 text-sm leading-relaxed text-ink">{row.reason}</td>
                <td className="px-4 py-4 text-sm text-ink-muted">
                  {row.createdByName ?? row.createdByEmail}
                </td>
                <td className="px-4 py-4">
                  <RoomBlockRowActions row={row} className="justify-end" />
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
            <div className="min-w-0">
              <p className="font-semibold text-ink">{row.roomName}</p>
              <p className="mt-0.5 text-xs leading-relaxed tabular-nums text-ink-muted">
                {formatRange(row.startTime, row.endTime)}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink">{row.reason}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                โดย {row.createdByName ?? row.createdByEmail}
              </p>
            </div>
            <RoomBlockRowActions row={row} className="mt-3" />
          </li>
        ))}
      </ul>
    </>
  );
}
