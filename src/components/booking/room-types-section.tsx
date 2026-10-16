// ข้อมูลประเภทห้องจาก TOR (seed ประเภทห้อง) — tone จำแนกสีต่อประเภท
const ROOM_TYPES = [
  {
    code: "S",
    name: "ห้องทั่วไป",
    badge: "bg-ku text-white",
    chip: "bg-ku-soft text-ku",
    mode: "จองทับกันได้ตามความจุ",
    min: "อย่างน้อย 1 ชั่วโมง",
    desc: "ห้องนั่งทำงานและอ่านหนังสือ ระบบจะนับจำนวนผู้ใช้ที่ครองช่วงเวลาซ้อนกัน จนครบความจุของห้อง",
  },
  {
    code: "G",
    name: "ห้องประชุมใหญ่",
    badge: "bg-blue text-white",
    chip: "bg-blue-soft text-blue",
    mode: "จองทับไม่ได้",
    min: "อย่างน้อย 2 ชั่วโมง",
    desc: "ห้องประชุมขนาดใหญ่ ช่วงเวลาเดียวกันมีได้เพียงการจองเดียว",
  },
  {
    code: "P",
    name: "ห้องละหมาด",
    badge: "bg-violet text-white",
    chip: "bg-violet-soft text-violet",
    mode: "จองทับไม่ได้",
    min: "อย่างน้อย 1 ชั่วโมง",
    desc: "ห้องละหมาด ช่วงเวลาเดียวกันมีได้เพียงการจองเดียว",
  },
] as const;

/**
 * รายการประเภทห้องพร้อมโหมดการจองและเวลาขั้นต่ำ — ข้อมูลอ่านจาก TOR
 * ใช้ร่วมกันระหว่างหน้าจองห้องของผู้ใช้และของแอดมิน
 */
export default function RoomTypesSection() {
  return (
    <section aria-labelledby="room-types">
      <h2
        id="room-types"
        className="text-base font-semibold tracking-tight text-ink"
      >
        ประเภทห้อง
      </h2>
      <ul className="panel mt-3 divide-y divide-border overflow-hidden">
        {ROOM_TYPES.map((type) => (
          <li
            key={type.code}
            className="flex flex-wrap items-center gap-x-4 gap-y-3 p-5"
          >
            <span
              aria-hidden="true"
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-base font-semibold ${type.badge}`}
            >
              {type.code}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="font-semibold text-ink">{type.name}</p>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${type.chip}`}
                >
                  {type.mode}
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                {type.desc}
              </p>
            </div>
            <span className="text-sm tabular-nums text-ink-muted">
              {type.min}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
