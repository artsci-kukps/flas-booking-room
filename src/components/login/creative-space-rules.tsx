import BookingRulesSection from "@/components/booking/booking-rules-section";
import RoomTypesSection from "@/components/booking/room-types-section";
import ServiceHoursSection from "@/components/booking/service-hours-section";
import StatusLegendSection from "@/components/booking/status-legend-section";

/**
 * ผนังกติกาฝั่งซ้ายของหน้าเข้าสู่ระบบ — สรุปจาก TOR.md ข้อ 4–8
 * ใช้คอมโพเนนต์ชุดเดียวกับหน้าจองห้อง เพื่อให้ศัพท์และหน้าตาตรงกันทั้งระบบ
 * (ส่วนที่หน้าจองห้องยังไม่มี ประกาศไว้ที่นี่เป็นชุดของตัวเอง)
 */

const SLOT_RULES = [
  {
    title: "เลือกเป็นบล็อกตามประเภทห้อง",
    body: "บล็อกเริ่มนับจากเวลาเปิดของวัน — ห้องทั่วไป/ละหมาด บล็อกละ 1 ชั่วโมง ห้องประชุมใหญ่ บล็อกละ 2 ชั่วโมง เช่น 08:30–10:30 — เลือกเป็นบล็อกจากระบบเท่านั้น พิมพ์เวลาเองไม่ได้",
  },
  {
    title: "ไม่จำกัดจำนวนครั้งและความยาว",
    body: "จองได้กี่ครั้งต่อวันก็ได้ และเลือกกี่บล็อกติดกันก็ได้ ไม่มีเพดานความยาวต่อหนึ่งการจอง",
  },
  {
    title: "บล็อกติดกันรวมเป็นรายการเดียว",
    body: "เลือก 08:30–09:30 ต่อด้วย 09:30–10:30 ระบบจะเก็บเป็นรายการเดียว 08:30–10:30",
  },
  {
    title: "บล็อกที่มีช่วงว่างคั่น แยกเป็นคนละรายการ",
    body: "เช่น 08:30–09:30 และ 10:30–11:30 จะเป็น 2 รายการ ต้องแจ้งรหัสรับกุญแจกับเจ้าหน้าที่ 2 ครั้ง",
  },
  {
    title: "ห้องทั่วไปจองทับได้ตามความจุ",
    body: "ห้องประเภท S รับผู้ใช้ซ้อนช่วงเวลาได้จนครบความจุของห้อง ส่วนห้องประชุมใหญ่ (G) และห้องละหมาด (P) มีได้เพียงการจองเดียวในแต่ละช่วงเวลา",
  },
] as const;

const KEY_RULES = [
  {
    title: "รับกุญแจด้วยรหัส 6 หลัก",
    body: "เมื่อจองสำเร็จ ระบบส่งรหัสตัวเลข 6 หลักไปทางอีเมล แจ้งรหัสนี้กับเจ้าหน้าที่ที่เคาน์เตอร์เพื่อรับกุญแจ",
  },
  {
    title: "รับกุญแจภายใน 30 นาทีหลังเวลาเริ่ม",
    body: "ถ้าเลยเวลาเริ่ม 30 นาทีแล้วยังไม่มารับ ระบบจะยกเลิกการจองและคืนห้องให้ผู้อื่นโดยอัตโนมัติ",
  },
  {
    title: "คืนกุญแจตามเวลาที่จอง",
    body: "การคืนกุญแจช้ากว่ากำหนดจะถูกบันทึกเป็นคืนล่าช้าไว้ในประวัติการจอง",
  },
  {
    title: "การจองแก้ไขไม่ได้ ต้องยกเลิกแล้วจองใหม่",
    body: "เพื่อให้ประวัติตรวจสอบย้อนหลังได้ตรงไปตรงมา ระบบไม่อนุญาตให้แก้เวลา/ห้องของการจองเดิม",
  },
] as const;

/** บล็อกกติกาแบบเดียวกับ BookingRulesSection — ใช้ซ้ำได้กับกติกาชุดอื่น */
function RuleSection({
  id,
  title,
  rules,
}: {
  id: string;
  title: string;
  rules: readonly { title: string; body: string }[];
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-base font-semibold tracking-tight text-ink">
        {title}
      </h2>
      <ul className="panel mt-3 divide-y divide-border">
        {rules.map((rule) => (
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

export default function CreativeSpaceRules({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-[0.8125rem] font-semibold text-ink">
          กติกาการเข้าใช้งานห้อง
        </p>
      </div>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-muted">
        สรุปจาก TOR.md เพื่อให้ผู้ใช้เข้าใจกติกาและความหมายของสถานะตรงกันทั้งระบบ
      </p>

      <div className="mt-4 grid gap-8 lg:gap-10">
        <RoomTypesSection />
        <ServiceHoursSection />
        <RuleSection
          id="login-slot-rules"
          title="การเลือกช่วงเวลา"
          rules={SLOT_RULES}
        />
        <BookingRulesSection />
        <RuleSection
          id="login-key-rules"
          title="การรับ–คืนกุญแจ"
          rules={KEY_RULES}
        />
        <StatusLegendSection />
      </div>
    </div>
  );
}
