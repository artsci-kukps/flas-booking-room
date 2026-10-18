import { listHolidays } from "@/lib/admin/holidays";
import { requireAdmin } from "@/lib/auth/guards";

import HolidaysManager from "./holidays-manager";

/**
 * จัดการวันหยุดนักขัตฤกษ์ ตาม TOR ข้อ 9
 * - เพิ่ม/ลบวันหยุดที่ปิดรับจองทั้งระบบ (วันเสาร์–อาทิตย์ปิดอยู่แล้ว ไม่ต้องลงข้อมูล)
 * - ห้ามซ้ำวันเดียวกัน (unique index ที่ DB) และลบแบบ hard delete
 */
export default async function HolidaysPage() {
  await requireAdmin();

  const rows = await listHolidays();

  return (
    <main className="page py-8 sm:py-10">
      <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
        วันหยุดนักขัตฤกษ์
      </h1>
      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
        วันที่ระบบปิดรับจองทั้งหมด นอกเหนือจากวันหยุดเสาร์–อาทิตย์
      </p>

      <HolidaysManager rows={rows} />
    </main>
  );
}
