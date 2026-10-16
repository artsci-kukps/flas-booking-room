import PlaceholderPanel from "@/components/placeholder-panel";

const POINTS = [
  "เวลาเปิด–ปิดระดับระบบ: วันปกติ 08:30–16:30",
  "ช่วงสอบ 08:30–20:30 ซ้อนทับช่วงปกติได้ โดยไม่ต้องแก้โค้ด",
  "ช่วงเวลาชนกันเองไม่ได้ — บังคับด้วย exclusion constraint",
  "เลือกช่วงที่มีผลจากวันที่ โดยช่วงสอบล่าสุดมีผลก่อน",
  "บล็อกจองเป็นช่วงละ 1 ชั่วโมง เริ่มจากเวลาเปิดของวันนั้น",
] as const;

/** ตั้งค่าเวลาให้บริการและค่าทั่วไปของระบบ ตาม TOR ข้อ 5 */
export default function SystemSettingPage() {
  return (
    <main className="page py-8 sm:py-10">
      <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
        ตั้งค่าระบบ
      </h1>
      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
        เวลาเปิด–ปิดของระบบ ช่วงปกติและช่วงสอบ ที่ใช้คำนวณ slot การจองทุกครั้ง
      </p>

      <PlaceholderPanel points={POINTS} />
    </main>
  );
}
