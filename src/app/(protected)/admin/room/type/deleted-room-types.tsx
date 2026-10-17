import RoomTypeCodeBadge from "@/components/room-type-code-badge";
import { formatThaiDateTime } from "@/lib/format";
import type { DeletedRoomTypeRow } from "@/lib/admin/room-types";

import RoomTypeRestoreButton from "./room-type-restore-button";

type DeletedRoomTypesProps = {
  rows: DeletedRoomTypeRow[];
};

/**
 * แผงรายการประเภทห้องที่ถูกลบ — แสดงรหัส ชื่อ เวลาที่ลบ และปุ่มกู้คืน
 * รายการที่ถูกลบจะไม่ปรากฏในรายการที่ใช้งานและไม่ถูกนำไปใช้จอง
 */
export default function DeletedRoomTypes({ rows }: DeletedRoomTypesProps) {
  return (
    <section className="panel p-5 sm:p-6">
      <h2 className="text-base font-semibold tracking-tight text-ink">รายการที่ถูกลบ</h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-muted">
        รายการที่ถูกลบจะไม่ถูกนำไปใช้จอง และกู้คืนกลับมาใช้ได้โดยไม่กระทบประวัติเดิม
      </p>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">ยังไม่มีรายการที่ถูกลบ</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <RoomTypeCodeBadge code={row.code} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{row.typeName}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                    ลบเมื่อ {formatThaiDateTime(row.deletedAt)}
                  </p>
                </div>
              </div>
              <RoomTypeRestoreButton id={row.id} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
