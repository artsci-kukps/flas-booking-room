import PlaceholderPanel from "@/components/placeholder-panel";

const POINTS = [
  "เลือกดูได้ตามวันและห้องที่สนใจ",
  "แสดงช่วงเวลาเป็นบล็อกละ 1 ชั่วโมง ตามเวลาเปิดของวันนั้น",
  "แยกสีตามสถานะครองช่วงเวลา (PENDING / ACTIVE)",
  "ช่วงที่ถูกบล็อกห้องและวันหยุดแสดงเป็นสีเทา",
] as const;

/** ตารางการจองภาพรวม — ดูว่าช่วงเวลาใดของห้องใดว่างหรือถูกจองแล้ว */
export default function TablePage() {
  return (
    <main className="page py-8 sm:py-10">
      <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
        ตารางจอง
      </h1>
      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
        ภาพรวมการจองของทุกห้องในหนึ่งวัน ใช้ดูความว่างก่อนกดจอง
      </p>

      <PlaceholderPanel points={POINTS} />
    </main>
  );
}
