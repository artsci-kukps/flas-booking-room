import Link from "next/link";

import PlaceholderPanel from "@/components/placeholder-panel";
// import StatusLegendSection from "@/components/booking/status-legend-section";

const POINTS = [
  "กรองตามช่วงวันและสถานะการจอง",
  "แสดงรหัส 6 หลักของแต่ละรายการ",
  "ยกเลิกได้เองเฉพาะสถานะ PENDING และต้องก่อนเวลาเริ่ม",
  "ดูเวลาบันทึกการรับ–คืนกุญแจของแต่ละรายการ",
] as const;

/**
 * ประวัติการจองของแอดมิน — เฉพาะการจองของตัวเอง (คนละชุดกับ
 * ประวัติทุกคนในหน้าการจองและรับ–คืนกุญแจ)
 */
export default function AdminHistoryPage() {
  return (
    <main className="page py-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
            ประวัติการจอง
          </h1>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
            รายการจองของคุณเองทั้งหมด พร้อมสถานะและการรับ–คืนกุญแจ
            ส่วนการจองของผู้ใช้ทุกคนอยู่ที่หน้าการจองและรับ–คืนกุญแจ
          </p>
        </div>
        <Link href="/admin/booking-management" className="btn btn-outline">
          ดูการจองทั้งระบบ
        </Link>
      </div>

      {/*<StatusLegendSection className="mt-8" />*/}

      <PlaceholderPanel points={POINTS} />
    </main>
  );
}
