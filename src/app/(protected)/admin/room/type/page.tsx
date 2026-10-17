import { listDeletedRoomTypes, listRoomTypes } from "@/lib/admin/room-types";
import { requireAdmin } from "@/lib/auth/guards";

import RoomTypesManager from "./room-types-manager";

/**
 * จัดการประเภทห้องและกติกาต่อประเภท ตาม TOR ข้อ 4
 * - เพิ่ม/แก้ไขรหัส ชื่อ โหมดการจอง และระยะเวลาขั้นต่ำ
 * - ลบแบบ soft delete (ห้ามลบประเภทที่ยังมีห้องใช้งาน — บังคับที่ DB trigger)
 * - กู้คืนรายการที่ถูกลบ หรือเพิ่มรหัส/ชื่อเดิมซ้ำจะกู้คืนแถวเดิมให้อัตโนมัติ
 */
export default async function RoomTypePage() {
  await requireAdmin();

  const [rows, deletedRows] = await Promise.all([listRoomTypes(), listDeletedRoomTypes()]);

  return (
    <main className="page py-8 sm:py-10">
      <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">ประเภทห้อง</h1>
      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
        นิยามประเภทห้องและกติกาการจองของแต่ละประเภท ที่ระบบใช้ตรวจทุกครั้งก่อนยืนยัน
      </p>

      <RoomTypesManager rows={rows} deletedRows={deletedRows} />
    </main>
  );
}
