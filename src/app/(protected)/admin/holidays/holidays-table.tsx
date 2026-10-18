import { formatThaiDate, formatThaiDateTime } from "@/lib/format";
import type { HolidayRow } from "@/lib/admin/holidays";

import HolidayRowActions from "./holiday-row-actions";

type HolidaysTableProps = {
  rows: HolidayRow[];
};

/**
 * ตารางวันหยุดนักขัตฤกษ์ — ตารางบนจอใหญ่ การ์ดบนมือถือ (แบบเดียวกับ users-table)
 * แสดงวันที่ ชื่อวันหยุด หมายเหตุ ผู้เพิ่ม/เวลาที่เพิ่ม และปุ่มลบ
 */
export default function HolidaysTable({ rows }: HolidaysTableProps) {
  if (rows.length === 0) {
    return (
      <section className="panel p-6">
        <p className="font-semibold text-ink">ยังไม่มีวันหยุดนักขัตฤกษ์</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          เพิ่มวันหยุดด้านบนเพื่อปิดรับจองทั้งระบบในวันนั้น
        </p>
      </section>
    );
  }

  return (
    <>
      {/* จอใหญ่: ตาราง */}
      <div className="panel hidden overflow-hidden md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">รายการวันหยุดนักขัตฤกษ์</caption>
          <thead>
            <tr className="border-b border-border bg-canvas">
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-ink-muted">
                วันที่หยุด
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-ink-muted">
                ชื่อวันหยุด
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-ink-muted">
                หมายเหตุ
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-ink-muted">
                เพิ่มเมื่อ
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-ink-muted">
                จัดการ
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id} className="align-top transition-colors hover:bg-canvas">
                <td className="px-4 py-4 text-sm font-semibold tabular-nums text-ink">
                  {formatThaiDate(row.holidayDate)}
                </td>
                <td className="px-4 py-4 text-sm text-ink">{row.name}</td>
                <td className="px-4 py-4 text-sm text-ink-muted">{row.note ?? "—"}</td>
                <td className="px-4 py-4 text-sm text-ink-muted">
                  {formatThaiDateTime(row.createdAt)}
                </td>
                <td className="px-4 py-4">
                  <HolidayRowActions row={row} className="justify-end" />
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
                <p className="font-semibold tabular-nums text-ink">
                  {formatThaiDate(row.holidayDate)}
                </p>
                <p className="mt-0.5 text-sm text-ink">{row.name}</p>
                {row.note ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{row.note}</p>
                ) : null}
                <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                  เพิ่มเมื่อ {formatThaiDateTime(row.createdAt)}
                </p>
              </div>
              <HolidayRowActions row={row} className="shrink-0" />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
