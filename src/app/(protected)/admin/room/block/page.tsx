import { listRoomBlocks } from "@/lib/admin/room-blocks";
import { listRooms } from "@/lib/admin/rooms";
import { requireAdmin } from "@/lib/auth/guards";

import RoomBlocksManager from "./room-blocks-manager";

/**
 * จัดการการบล็อกห้อง ตาม TOR ข้อ 9
 * - แอดมินปิดห้องชั่วคราว (เช่น ปิดปรับปรุง) ระบุห้อง ช่วงเวลา และเหตุผล (บังคับ)
 * - ห้ามมีรายการบล็อกที่ทับซ้อนกันในห้องเดียวกัน (exclusion constraint ที่ DB)
 * - ลบจริง (hard delete) ไม่มี soft delete เพราะเป็นข้อมูลเชิงเวลา
 */
export default async function RoomBlockPage() {
  await requireAdmin();

  const [rows, rooms] = await Promise.all([listRoomBlocks(), listRooms()]);

  return (
    <main className="page py-8 sm:py-10">
      <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">บล็อกห้อง</h1>
      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
        ระงับห้องบางช่วงเวลา เช่น ปิดปรับปรุง หรือเหตุจำเป็นอื่น พร้อมเหตุผล
      </p>

      <RoomBlocksManager rows={rows} rooms={rooms} />
    </main>
  );
}
