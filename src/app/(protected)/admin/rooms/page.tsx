import { listDeletedRooms, listRooms } from "@/lib/admin/rooms";
import { listRoomTypes } from "@/lib/admin/room-types";
import { requireAdmin } from "@/lib/auth/guards";

import RoomsManager from "./rooms-manager";

/**
 * จัดการข้อมูลห้อง — soft delete + restore ตาม TOR ข้อ 10
 * - เพิ่ม/แก้ไขชื่อห้อง ประเภท ความจุ และสิ่งอำนวยความสะดวก
 * - ความจำเป็นเงื่อนไข: ประเภท CAPACITY ต้องระบุความจุ > 0
 * - กู้คืนรายการที่ถูกลบ หรือเพิ่มชื่อเดิมซ้ำจะกู้คืนแถวเดิมให้อัตโนมัติ
 */
export default async function RoomsPage() {
  await requireAdmin();

  const [rows, deletedRows, roomTypes] = await Promise.all([
    listRooms(),
    listDeletedRooms(),
    listRoomTypes(),
  ]);

  return (
    <main className="page py-8 sm:py-10">
      <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">ห้อง</h1>
      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
        รายชื่อห้องทั้งหมดในระบบ ความจุ สิ่งอำนวยความสะดวก และสถานะการใช้งาน
      </p>

      <RoomsManager rows={rows} deletedRows={deletedRows} roomTypes={roomTypes} />
    </main>
  );
}
