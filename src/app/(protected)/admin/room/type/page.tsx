import PlaceholderPanel from "@/components/placeholder-panel";

const POINTS = [
  "3 ประเภท: S ห้องทั่วไป, G ห้องประชุมใหญ่, P ห้องละหมาด",
  "กำหนดโหมดการจอง (CAPACITY / EXCLUSIVE) และเวลาขั้นต่ำเป็นข้อมูล ไม่ hardcode",
  "ลบแบบ soft delete และกู้คืนแบบใช้แถวเดิม (reuse) เพื่อรักษา FK ของประวัติ",
  "ห้ามลบประเภทที่ยังมีห้องใช้งานอยู่ — บังคับที่ระดับฐานข้อมูล",
  "ชื่อและรหัสประเภทห้องห้ามซ้ำเฉพาะที่ยังไม่ถูกลบ",
] as const;

/** จัดการประเภทห้องและกติกาต่อประเภท ตาม TOR ข้อ 4 */
export default function RoomTypePage() {
  return (
    <main className="page py-8 sm:py-10">
      <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
        ประเภทห้อง
      </h1>
      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
        นิยามประเภทห้องและกติกาการจองของแต่ละประเภท ที่ระบบใช้ตรวจทุกครั้งก่อนยืนยัน
      </p>

      <PlaceholderPanel points={POINTS} />
    </main>
  );
}
