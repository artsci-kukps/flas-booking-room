import PlaceholderPanel from "@/components/placeholder-panel";

const POINTS = [
  "วันหยุดนักขัตฤกษ์ — เพิ่มหรือลบเพื่อปิดระบบจองทั้งวัน",
  "วันเสาร์–อาทิตย์ปิดอยู่แล้ว ไม่ต้องลงข้อมูล",
  "วันหยุดห้ามซ้ำกัน (หนึ่งวันมีได้หนึ่งรายการ)",
  "ผู้ที่เพิ่มและเวลาที่เพิ่มถูกบันทึกไว้กับแต่ละรายการ",
  "ลบได้จริง (hard delete) เพราะเป็นข้อมูลเชิงเวลา",
] as const;

/** จัดการวันหยุด ตาม TOR ข้อ 9 */
export default function HolidaysPage() {
  return (
    <main className="page py-8 sm:py-10">
      <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
        วันหยุดนักขัตฤกษ์
      </h1>
      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
        วันที่ระบบปิดรับจองทั้งหมด นอกเหนือจากวันหยุดเสาร์–อาทิตย์
      </p>

      <PlaceholderPanel points={POINTS} />
    </main>
  );
}
