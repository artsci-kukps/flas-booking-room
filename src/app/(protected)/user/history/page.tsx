import PlaceholderPanel from "@/components/placeholder-panel";
import StatusLegendSection from "@/components/booking/status-legend-section";

const POINTS = [
  "กรองตามช่วงวันและสถานะการจอง",
  "แสดงรหัส 6 หลักของแต่ละรายการ",
  "ยกเลิกได้เองเฉพาะสถานะ PENDING และต้องก่อนเวลาเริ่ม",
  "ดูเวลาบันทึกการรับ–คืนกุญแจของแต่ละรายการ",
] as const;

/** ประวัติการจองย้อนหลังของผู้ใช้คนเดียว */
export default function HistoryPage() {
  return (
    <main className="page py-8 sm:py-10">
      <div className="max-w-2xl">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
          ประวัติการจอง
        </h1>
        <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
          รายการจองทั้งหมดของคุณ พร้อมสถานะและการรับ–คืนกุญแจ
        </p>
      </div>

      <StatusLegendSection className="mt-8" />

      <PlaceholderPanel points={POINTS} />
    </main>
  );
}
