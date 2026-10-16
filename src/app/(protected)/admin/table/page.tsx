import Link from "next/link";

import PlaceholderPanel from "@/components/placeholder-panel";

const POINTS = [
  "เลือกดูได้ตามวันและห้องที่สนใจ",
  "แสดงช่วงเวลาเป็นบล็อกละ 1 ชั่วโมง ตามเวลาเปิดของวันนั้น",
  "แยกสีตามสถานะครองช่วงเวลา (PENDING / ACTIVE)",
  "ช่วงที่ถูกล็อกห้องและวันหยุดแสดงเป็นสีเทา",
  "ดูแลจัดการโดยตรงได้ที่หน้าการจองและรับ–คืนกุญแจ",
] as const;

/**
 * ตารางจองของแอดมิน — ภาพรวมทุกห้องในหนึ่งวัน ใช้ดูความว่างก่อนกดจอง
 * และเป็นทางเข้าสู่ศูนย์จัดการจองของระบบ
 */
export default function AdminTablePage() {
  return (
    <main className="page py-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
            ตารางจอง
          </h1>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
            ภาพรวมการจองของทุกห้องในหนึ่งวัน ใช้ดูความว่างก่อนกดจอง
            และติดตามว่าช่วงเวลาใดถูกใช้ไปแล้ว
          </p>
        </div>
        <Link href="/admin/booking-management" className="btn btn-outline">
          จัดการการจอง
        </Link>
      </div>

      <PlaceholderPanel points={POINTS} />
    </main>
  );
}
