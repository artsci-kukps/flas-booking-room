import RoomTypeCodeBadge from "@/components/room-type-code-badge";
import type { AdminRoomRow } from "@/lib/admin/rooms";

import RoomRowActions from "./room-row-actions";

/** เซลล์ประเภทห้อง — ป้ายรหัสสีจำแนก + ชื่อประเภท */
function RoomTypeCell({ row }: { row: AdminRoomRow }) {
  return (
    <div className="flex items-center gap-2">
      <RoomTypeCodeBadge code={row.roomTypeCode} />
      <span className="text-sm text-ink-muted">{row.roomTypeName}</span>
    </div>
  );
}

/** ความจุ — แสดงขีดกลางเมื่อไม่ระบุ (ประเภทที่ห้ามจองทับไม่ต้องใช้) */
function CapacityValue({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-ink-muted">ไม่ระบุ</span>;
  }

  return <span className="tabular-nums">{value} คน</span>;
}

/** สิ่งอำนวยความสะดวก — แสดงขีดกลางเมื่อว่าง */
function FacilitiesValue({ value }: { value: string | null }) {
  if (!value) {
    return <span className="text-ink-muted">—</span>;
  }

  return <span className="line-clamp-2">{value}</span>;
}

type RoomsTableProps = {
  rows: AdminRoomRow[];
  /** เปิดฟอร์มแก้ไขของแถวนี้ที่แผงด้านบน */
  onEdit: (row: AdminRoomRow) => void;
};

/**
 * ตารางห้องที่ใช้งานอยู่ — ตารางบนจอใหญ่ การ์ดบนมือถือ (แบบเดียวกับ users-table)
 * แสดงชื่อ ประเภท ความจุ สิ่งอำนวยความสะดวก และปุ่มแก้ไข/ลบ
 */
export default function RoomsTable({ rows, onEdit }: RoomsTableProps) {
  if (rows.length === 0) {
    return (
      <section className="panel p-6">
        <p className="font-semibold text-ink">ยังไม่มีห้องในระบบ</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          เพิ่มห้องด้านบนเพื่อให้ผู้ใช้เริ่มจองได้
        </p>
      </section>
    );
  }

  return (
    <>
      {/* จอใหญ่: ตาราง */}
      <div className="panel hidden overflow-hidden md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">รายการห้องที่ใช้งานอยู่</caption>
          <thead>
            <tr className="border-b border-border bg-canvas">
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-ink-muted">
                ชื่อห้อง
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-ink-muted">
                ประเภท
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-ink-muted">
                ความจุ
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-ink-muted">
                สิ่งอำนวยความสะดวก
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
                  <RoomTypeCell row={row} />
                </td>
                <td className="px-4 py-4 text-sm text-ink-muted">
                  <CapacityValue value={row.maxCapacity} />
                </td>
                <td className="max-w-xs px-4 py-4 text-sm text-ink-muted">
                  <FacilitiesValue value={row.facilities} />
                </td>
                <td className="px-4 py-4">
                  <RoomRowActions row={row} onEdit={() => onEdit(row)} className="justify-end" />
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
              <p className="font-semibold text-ink">{row.name}</p>
              <RoomTypeCell row={row} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-ink-muted">
              <div>
                <dt className="font-semibold text-ink">ความจุ</dt>
                <dd className="mt-0.5 text-sm text-ink-muted">
                  <CapacityValue value={row.maxCapacity} />
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="font-semibold text-ink">สิ่งอำนวยความสะดวก</dt>
                <dd className="mt-0.5 text-sm text-ink-muted">
                  <FacilitiesValue value={row.facilities} />
                </dd>
              </div>
            </dl>
            <RoomRowActions row={row} onEdit={() => onEdit(row)} className="mt-3" />
          </li>
        ))}
      </ul>
    </>
  );
}
