import { meetsMinDuration, type BookingPlan } from "@/lib/booking/booking-plan";

/**
 * สรุปก่อนกดยืนยันการจอง — บอกจำนวนครั้งที่ต้องยืนยันกับเจ้าหน้าที่ (= จำนวน record)
 * พร้อมรายการแต่ละ record (ห้อง ช่วงเวลา) และเตือนเมื่อยังไม่ครบระยะเวลาขั้นต่ำของประเภทห้อง
 * เป็น component บริสุทธิ์ (ไม่ถือ state) เพื่อให้ทดสอบข้อความได้ตรง ๆ
 */

type BookingSummaryProps = {
  plan: BookingPlan;
  roomName: string;
  minDurationMinutes: number;
};

export default function BookingSummary({
  plan,
  roomName,
  minDurationMinutes,
}: BookingSummaryProps) {
  if (plan.records.length === 0) {
    return (
      <p className="text-base font-semibold text-ink">
        แตะช่องว่างเพื่อเลือกเวลาที่จะจอง (เลือกได้หลายชั่วโมง)
      </p>
    );
  }

  const durationOk = meetsMinDuration(plan, minDurationMinutes);

  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold text-ink-muted">การจองของคุณ</p>
      <p className="mt-0.5 text-base font-semibold text-ink">ห้อง {roomName}</p>

      <ul className="mt-1.5 space-y-0.5 text-sm tabular-nums text-ink">
        {plan.records.map((record) => (
          <li key={record.start}>
            {record.start}–{record.end} น.
          </li>
        ))}
      </ul>

      <p className="mt-1.5 text-sm font-medium text-ku">
        ต้องยืนยันกับเจ้าหน้าที่ {plan.confirmationCount} ครั้ง
      </p>

      {durationOk ? null : (
        <p role="alert" className="mt-1.5 text-sm font-medium text-danger">
          ห้องนี้ต้องจองอย่างน้อย {minDurationMinutes} นาที กรุณาเลือกช่วงเวลาต่อเนื่องให้ครบ
        </p>
      )}
    </div>
  );
}
