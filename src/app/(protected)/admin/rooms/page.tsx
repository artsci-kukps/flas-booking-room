import PlaceholderPanel from "@/components/placeholder-panel";

const POINTS = [
  "เพิ่ม แก้ไขชื่อห้อง สิ่งอำนวยความสะดวก และความจุ",
  "ผูกห้องกับประเภทห้อง (S / G / P)",
  "ลบแบบ soft delete และกู้คืนได้ พร้อมผู้ที่ทำการลบ",
  "ชื่อห้องห้ามซ้ำเฉพาะรายการที่ยังไม่ถูกลบ",
  "ห้องที่ถูกลบแล้วจะไม่ถูกนำไปจอง",
] as const;

/** จัดการข้อมูลห้อง — soft delete + restore ตาม TOR ข้อ 10 */
export default function RoomsPage() {
  return (
    <main className="page py-8 sm:py-10">
      <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
        ห้อง
      </h1>
      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
        รายชื่อห้องทั้งหมดในระบบ ความจุ สิ่งอำนวยความสะดวก และสถานะการใช้งาน
      </p>

      <PlaceholderPanel points={POINTS} />
    </main>
  );
}
