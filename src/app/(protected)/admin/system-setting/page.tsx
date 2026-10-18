import { listServicePeriods, todayInBangkok } from "@/lib/admin/service-periods";
import { requireAdmin } from "@/lib/auth/guards";

import ServicePeriodsManager from "./service-periods-manager";

/**
 * ตั้งค่าเวลาให้บริการของระบบ ตาม TOR ข้อ 5 และ ภาคผนวก B ข้อ 1
 * - เพิ่ม/แก้ไข/ลบช่วงเวลา (NORMAL วันปกติ / EXAM ช่วงสอบ) พร้อมเวลาเปิด–ปิดและวันที่มีผล
 * - ช่วงสอบซ้อนทับช่วงปกติได้ แต่ช่วงชนิดเดียวกันห้ามทับซ้อน
 *   (exclusion constraint `service_period_no_overlap` ที่ระดับ DB)
 * - ค่าเริ่มต้น NORMAL 08:30–16:30 ถูก seed อัตโนมัติหลังตั้งแอดมินคนแรก
 *   ผ่าน `npm run seed:admin`
 */
export default async function SystemSettingPage() {
  await requireAdmin();

  const rows = await listServicePeriods();
  const today = todayInBangkok();

  return (
    <main className="page py-8 sm:py-10">
      <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">ตั้งค่าระบบ</h1>
      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
        เวลาเปิด–ปิดของระบบ ช่วงปกติและช่วงสอบ ที่ระบบใช้คำนวณ slot การจองทุกครั้ง
      </p>

      <ServicePeriodsManager rows={rows} today={today} />
    </main>
  );
}
