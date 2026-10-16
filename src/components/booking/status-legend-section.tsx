// สถานะทั้ง 6 ตาม TOR — หน้าประวัติต้องอธิบายความหมายให้ผู้ใช้อ่านออก
const STATUS_LEGEND = [
  "PENDING — จองแล้ว รอมาแสดงรหัส 6 หลักเพื่อรับกุญแจ",
  "ACTIVE — รับกุญแจและกำลังใช้งานห้อง",
  "COMPLETED — คืนกุญแจตรงเวลา",
  "LATE_RETURN — คืนกุญแจช้ากว่าเวลาที่จอง",
  "CANCELLED — การจองถูกยกเลิก",
  "NO_SHOW — ไม่มารับกุญแจภายใน 30 นาทีหลังเวลาเริ่ม",
] as const;

/**
 * คำอธิบายความหมายของสถานะทั้ง 6 — ใช้ร่วมกันระหว่างหน้าประวัติ
 * ของผู้ใช้และของแอดมิน เพื่อให้ศัพท์เดียวกันทั้งระบบ
 */
export default function StatusLegendSection({
  className = "",
}: {
  /** เว้นวรรคด้านบนของบล็อก — หน้าประวัติใช้ mt-8 ให้ตรงจังหวะกับการ์ดถัดไป */
  className?: string;
}) {
  return (
    <section aria-labelledby="status-legend" className={className}>
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
  );
}
