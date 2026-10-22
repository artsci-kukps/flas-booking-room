/**
 * เวลาทำการ — ทั้งวันปกติและช่วงสอบ ดึงจากค่าบริการเดียวกับที่ระบบใช้จอง
 * ใช้ร่วมกันระหว่างหน้าจองห้องของผู้ใช้และของแอดมิน
 */
import { BLOCK_LENGTH_COPY } from "@/lib/booking/slot-display";

export default function ServiceHoursSection() {
  return (
    <section aria-labelledby="service-hours">
      <h2
        id="service-hours"
        className="text-base font-semibold tracking-tight text-ink"
      >
        เวลาทำการ
      </h2>
      <dl className="panel mt-3 divide-y divide-border">
        <div className="flex items-baseline justify-between gap-4 p-4">
          <dt className="text-sm text-ink-muted">วันปกติ (จันทร์–ศุกร์)</dt>
          <dd className="text-sm font-semibold tabular-nums text-ink">
            08:30–16:30
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 p-4">
          <dt className="text-sm text-ink-muted">ช่วงสอบ</dt>
          <dd className="text-sm font-semibold tabular-nums text-ink">
            08:30–20:30
          </dd>
        </div>
        <div className="p-4">
          <dt className="text-sm text-ink-muted">ปิดทำการ</dt>
          <dd className="mt-0.5 text-sm leading-relaxed text-ink">
            วันเสาร์–อาทิตย์ และวันหยุดนักขัตฤกษ์
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-muted">
        เวลาจองนับเป็นบล็อกตามประเภทห้อง — {BLOCK_LENGTH_COPY} เช่น 08:30–10:30
      </p>
    </section>
  );
}
