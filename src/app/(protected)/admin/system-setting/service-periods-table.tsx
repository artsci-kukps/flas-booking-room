import type { ReactNode } from "react";

import {
  formatEffectiveRange,
  formatServiceTimeRange,
  isEffectiveOn,
  SERVICE_PERIOD_KIND_LABEL,
} from "@/lib/admin/service-period-display";
import type { ServicePeriodKind, ServicePeriodRow } from "@/lib/admin/service-periods";

import ServicePeriodRowActions from "./service-period-row-actions";

/** ป้ายชนิด — เขียวแบรนด์ = วันปกติ, ขอบเส้น = ช่วงสอบ (แยกให้เห็นชัดจากช่วงปกติ) */
function KindChip({ kind }: { kind: ServicePeriodKind }) {
  const styles =
    kind === "NORMAL" ? "bg-ku-soft text-ku" : "border border-border bg-canvas text-ink";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${styles}`}>
      {SERVICE_PERIOD_KIND_LABEL[kind]}
    </span>
  );
}

/** ป้าย "มีผลวันนี้" — แสดงเมื่อช่วงเวลานี้ครอบวันที่กำหนด */
function TodayChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-canvas px-2.5 py-1 text-xs font-semibold text-ink-muted">
      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-ku" />
      {children}
    </span>
  );
}

type ServicePeriodsTableProps = {
  rows: ServicePeriodRow[];
  /** วันปัจจุบัน YYYY-MM-DD (คำนวณฝั่งเซิร์ฟเวอร์ด้วยเขตเวลา Asia/Bangkok) */
  today: string;
  /** เปิดฟอร์มแก้ไขของแถวนี้ที่แผงด้านบน */
  onEdit: (row: ServicePeriodRow) => void;
};

/**
 * ตารางช่วงเวลาให้บริการ — ตารางบนจอใหญ่ การ์ดบนมือถือ (แบบเดียวกับ room-types-table)
 * แสดงชนิด เวลาเปิด–ปิด วันที่มีผล และปุ่มแก้ไข/ลบ
 */
export default function ServicePeriodsTable({ rows, today, onEdit }: ServicePeriodsTableProps) {
  if (rows.length === 0) {
    return (
      <section className="panel p-6">
        <p className="font-semibold text-ink">ยังไม่มีช่วงเวลาให้บริการ</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          เพิ่มช่วงเวลาด้านบนเพื่อกำหนดเวลาเปิด–ปิดของระบบ เช่น วันปกติ 08:30–16:30
        </p>
      </section>
    );
  }

  return (
    <>
      {/* จอใหญ่: ตาราง */}
      <div className="panel hidden overflow-hidden md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">รายการช่วงเวลาให้บริการ</caption>
          <thead>
            <tr className="border-b border-border bg-canvas">
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-ink-muted">
                ชื่อช่วงเวลา
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-ink-muted">
                ประเภท
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-ink-muted">
                เวลาเปิด–ปิด
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-ink-muted">
                วันที่มีผล
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-ink-muted">
                จัดการ
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id} className="align-top transition-colors hover:bg-canvas">
                <td className="px-4 py-4 text-sm font-semibold text-ink">{row.name}</td>
                <td className="px-4 py-4">
                  <KindChip kind={row.kind} />
                </td>
                <td className="px-4 py-4 text-sm tabular-nums text-ink">
                  {formatServiceTimeRange(row)}
                </td>
                <td className="px-4 py-4 text-sm text-ink-muted">
                  {formatEffectiveRange(row)}
                  {isEffectiveOn(row, today) ? (
                    <span className="mt-1.5 block">
                      <TodayChip>มีผลวันนี้</TodayChip>
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-4">
                  <ServicePeriodRowActions
                    row={row}
                    onEdit={() => onEdit(row)}
                    className="justify-end"
                  />
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
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 font-semibold text-ink">{row.name}</p>
              <KindChip kind={row.kind} />
              {isEffectiveOn(row, today) ? <TodayChip>มีผลวันนี้</TodayChip> : null}
            </div>
            <p className="mt-1 text-sm tabular-nums text-ink-muted">
              {formatServiceTimeRange(row)} · {formatEffectiveRange(row)}
            </p>
            <ServicePeriodRowActions row={row} onEdit={() => onEdit(row)} className="mt-3" />
          </li>
        ))}
      </ul>
    </>
  );
}
