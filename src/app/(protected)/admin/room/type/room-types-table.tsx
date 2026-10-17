import RoomTypeCodeBadge from "@/components/room-type-code-badge";
import { BOOKING_MODE_LABEL, formatMinutes } from "@/lib/admin/room-display";
import type { RoomTypeRow } from "@/lib/admin/room-types";

import RoomTypeRowActions from "./room-type-row-actions";

type RoomTypesTableProps = {
  rows: RoomTypeRow[];
  /** เปิดฟอร์มแก้ไขของแถวนี้ที่แผงด้านบน */
  onEdit: (row: RoomTypeRow) => void;
};

/**
 * ตารางประเภทห้องที่ใช้งานอยู่ — ตารางบนจอใหญ่ การ์ดบนมือถือ (แบบเดียวกับ users-table)
 * แสดงรหัส ชื่อ โหมดการจอง ระยะเวลาขั้นต่ำ และปุ่มแก้ไข/ลบ
 */
export default function RoomTypesTable({ rows, onEdit }: RoomTypesTableProps) {
  if (rows.length === 0) {
    return (
      <section className="panel p-6">
        <p className="font-semibold text-ink">ยังไม่มีประเภทห้อง</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          เพิ่มประเภทห้องด้านบนเพื่อกำหนดกติกาการจองของห้องแต่ละกลุ่ม
        </p>
      </section>
    );
  }

  return (
    <>
      {/* จอใหญ่: ตาราง */}
      <div className="panel hidden overflow-hidden md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">รายการประเภทห้องที่ใช้งานอยู่</caption>
          <thead>
            <tr className="border-b border-border bg-canvas">
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-ink-muted">
                รหัส
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-ink-muted">
                ชื่อประเภท
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-ink-muted">
                โหมดการจอง
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-ink-muted">
                ระยะเวลาขั้นต่ำ
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-ink-muted">
                จัดการ
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id} className="align-top transition-colors hover:bg-canvas">
                <td className="px-4 py-4">
                  <RoomTypeCodeBadge code={row.code} />
                </td>
                <td className="px-4 py-4 text-sm font-semibold text-ink">{row.typeName}</td>
                <td className="px-4 py-4 text-sm text-ink-muted">
                  {BOOKING_MODE_LABEL[row.bookingMode]}
                </td>
                <td className="px-4 py-4 text-sm tabular-nums text-ink-muted">
                  {formatMinutes(row.minDurationMinutes)}
                </td>
                <td className="px-4 py-4">
                  <RoomTypeRowActions
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
            <div className="flex items-start gap-3">
              <RoomTypeCodeBadge code={row.code} />
              <div className="min-w-0">
                <p className="font-semibold text-ink">{row.typeName}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                  {BOOKING_MODE_LABEL[row.bookingMode]} · ขั้นต่ำ{" "}
                  {formatMinutes(row.minDurationMinutes)}
                </p>
              </div>
            </div>
            <RoomTypeRowActions row={row} onEdit={() => onEdit(row)} className="mt-3" />
          </li>
        ))}
      </ul>
    </>
  );
}
