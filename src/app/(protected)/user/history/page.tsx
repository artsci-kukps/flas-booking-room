import PlaceholderPanel from "@/components/placeholder-panel";

// สถานะทั้ง 6 ตาม TOR — หน้าประวัติต้องอธิบายความหมายให้ผู้ใช้อ่านออก
const STATUS_LEGEND = [
  "PENDING — จองแล้ว รอมาแสดงรหัส 6 หลักเพื่อรับกุญแจ",
  "ACTIVE — รับกุญแจและกำลังใช้งานห้อง",
  "COMPLETED — คืนกุญแจตรงเวลา",
  "LATE_RETURN — คืนกุญแจช้ากว่าเวลาที่จอง",
  "CANCELLED — การจองถูกยกเลิก",
  "NO_SHOW — ไม่มารับกุญแจภายใน 30 นาทีหลังเวลาเริ่ม",
] as const;

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
      <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
        ประวัติการจอง
      </h1>
      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
        รายการจองทั้งหมดของคุณ พร้อมสถานะและการรับ–คืนกุญแจ
      </p>

      <section aria-labelledby="status-legend" className="mt-8">
        <h2
          id="status-legend"
          className="text-base font-semibold tracking-tight text-ink"
        >
          ความหมายของสถานะ
        </h2>
        <ul className="panel mt-3 divide-y divide-border">
          {STATUS_LEGEND.map((item) => (
            <li key={item} className="p-4 text-sm leading-relaxed text-ink-muted">
              {item}
            </li>
          ))}
        </ul>
      </section>

      <PlaceholderPanel points={POINTS} />
    </main>
  );
}
