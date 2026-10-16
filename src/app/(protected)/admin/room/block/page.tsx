import PlaceholderPanel from "@/components/placeholder-panel";

const POINTS = [
  "ปิดปรับปรุงห้องเป็นช่วงเวลา พร้อมเหตุผลที่บันทึกไว้กับรายการ",
  "ห้ามมีรายการบล็อกที่ทับซ้อนกันในห้องเดียวกัน",
  "ระบบจะไม่ให้จองช่วงเวลาที่ทับกับการบล็อก ตรวจทุกครั้งก่อนยืนยัน",
  "ลบได้จริง (hard delete) เพราะเป็นข้อมูลเชิงเวลา",
  "ผู้ที่สร้างและเวลาที่สร้างถูกบันทึกไว้กับแต่ละรายการ",
] as const;

/** ปิดห้องเป็นช่วงเวลา ตาม TOR ข้อ 9 */
export default function RoomBlockPage() {
  return (
    <main className="page py-8 sm:py-10">
      <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
        บล็อกห้อง
      </h1>
      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
        ระงับห้องบางช่วงเวลา เช่น ปิดปรับปรุง หรือเหตุจำเป็นอื่น พร้อมเหตุผล
      </p>

      <PlaceholderPanel points={POINTS} />
    </main>
  );
}
