import Alert from "@/components/alert";
import { listUsers } from "@/lib/admin/users";
import { requireAdmin } from "@/lib/auth/guards";

import UsersTable from "./users-table";

/**
 * จัดการผู้ใช้และสิทธิ์ ตาม TOR ข้อ 3.2–3.3
 * - เปลี่ยนบทบาท user ↔ admin และระงับ/ปลดระงับบัญชี
 * - ห้ามลบผู้ใช้: ไม่มีปุ่มหรือกลไกลบใด ๆ
 * - ผู้ถูกระงับถูกตัดสิทธิ์ทันทีจาก requireUser() ใน (protected)/layout (ตั๋ว 2)
 */
export default async function UsersPage() {
  const admin = await requireAdmin();
  const rows = await listUsers();

  return (
    <main className="page py-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
            ผู้ใช้และสิทธิ์
          </h1>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
            รายชื่อบัญชี @ku.th ทั้งหมด เปลี่ยนบทบาทผู้ดูแล
            และระงับหรือปลดระงับการใช้งาน
          </p>
        </div>
      </div>

      <UsersTable rows={rows} currentAdminId={admin.id} />

      <Alert
        tone="info"
        heading="ระบบไม่มีการลบผู้ใช้"
        body="เพื่อรักษาความเชื่อมโยงของประวัติการจอง บัญชีที่ถูกระงับจะถูกตัดสิทธิ์ทันทีในทุกเส้นทาง และระบบจะไม่ยอมให้เหลือผู้ดูแลที่ใช้งานได้เป็นศูนย์คน"
        className="mt-4"
      />
    </main>
  );
}
