import PlaceholderPanel from "@/components/placeholder-panel";

const POINTS = [
  "ดูตารางการจองทั้งระบบ แยกตามวันและห้อง",
  "ค้นหารายการด้วยรหัส 6 หลัก จำกัดเฉพาะวันปัจจุบัน",
  "ยืนยันรับกุญแจ → ACTIVE และคืนกุญแจ → COMPLETED หรือ LATE_RETURN",
  "ยกเลิกการจองได้เสมอ พร้อมบันทึกเหตุผลและผู้ดำเนินการ",
  "NO_SHOW อัตโนมัติเมื่อเลยเวลาเริ่ม 30 นาที",
  "ผู้ใช้ไม่มารับกุญแจ ระบบจะปล่อยห้องคืนทันที",
] as const;

/** ศูนย์กลางการจองของระบบ: ตาราง ยืนยันรับ–คืนกุญแจ และยกเลิก */
export default function BookingManagementPage() {
  return (
    <main className="page py-8 sm:py-10">
      <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
        การจองและรับ–คืนกุญแจ
      </h1>
      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
        จัดการการจองทุกฉบับของระบบ ตั้งแต่ยืนยันรหัส 6 หลักจนถึงการคืนกุญแจ
      </p>

      <PlaceholderPanel points={POINTS} />
    </main>
  );
}
