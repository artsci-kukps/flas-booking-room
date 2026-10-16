const RULES = [
  {
    title: "มารับกุญแจภายใน 30 นาที",
    body: "เลยเวลาเริ่ม 30 นาทีแล้วยังไม่มารับ ระบบจะยกเลิกการจองให้อัตโนมัติ",
  },
  {
    title: "คืนกุญแจตามเวลาที่จอง",
    body: "การคืนช้ากว่าเวลาที่จองจะถูกบันทึกไว้ในประวัติการจอง",
  },
  {
    title: "ยกเลิกได้เองก่อนเริ่มใช้งาน",
    body: "ได้เฉพาะการจองที่ยังอยู่ในสถานะรอรับกุญแจ และต้องทำก่อนเวลาเริ่ม",
  },
  {
    title: "ห้ามจองซ้อนช่วงเวลาเดียวกัน",
    body: "ผู้ใช้คนเดียวมีการจองที่ทับซ้อนกันไม่ได้ แม้จะเป็นคนละห้อง",
  },
] as const;

/**
 * กติกาสำคัญของการจองห้อง — ชุดเดียวกันทุกคน รวมถึงแอดมิน
 * ใช้ร่วมกันระหว่างหน้าจองห้องของผู้ใช้และของแอดมิน
 */
export default function BookingRulesSection() {
  return (
    <section aria-labelledby="rules">
      <h2
        id="rules"
        className="text-base font-semibold tracking-tight text-ink"
      >
        กติกาสำคัญ
      </h2>
      <ul className="panel mt-3 divide-y divide-border">
        {RULES.map((rule) => (
          <li key={rule.title} className="p-4">
            <p className="text-sm font-semibold text-ink">{rule.title}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">
              {rule.body}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
