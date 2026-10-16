import PlaceholderPanel from "@/components/placeholder-panel";

const POINTS = [
  "เปลี่ยนบทบาทระหว่าง user และ admin",
  "ระงับหรือปลดระงับบัญชี พร้อมวันเวลาและผู้ที่ทำการระงับ",
  "ไม่มีการลบผู้ใช้เด็ดขาด เพื่อรักษาความเชื่อมโยงของประวัติ",
  "ค้นหาผู้ใช้จากอีเมลและชื่อ แสดงสถานะการเข้าใช้งานล่าสุด",
  "แอดมินคนแรกเกิดจากการเพิ่มข้อมูลโดยตรงในฐานข้อมูล (seed)",
] as const;

/** จัดการผู้ใช้และสิทธิ์ ตาม TOR ข้อ 3.2–3.3 */
export default function UsersPage() {
  return (
    <main className="page py-8 sm:py-10">
      <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
        ผู้ใช้และสิทธิ์
      </h1>
      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
        รายชื่อบัญชี @ku.th ในระบบ การเปลี่ยนบทบาท และการระงับการใช้งาน
      </p>

      <PlaceholderPanel points={POINTS} />
    </main>
  );
}
