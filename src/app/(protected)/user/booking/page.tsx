import { requireUser } from "@/lib/auth/guards";

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

/** ชื่อแสดงบนหัวหน้า: เอาชื่อจริง (โทเคนแรก) ถ้ามี ไม่งั้นใช้หน้าอีเมล */
function displayName(fullName: string | null, email: string): string {
  const name = fullName?.trim();
  if (name) return name.split(/\s+/)[0]!;
  return email.split("@")[0]!;
}

export default async function BookingPage() {
  const user = await requireUser();
  const name = displayName(user.fullName, user.email);

  return (
    <main className="page py-8 sm:py-10">
      <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
        จองห้อง
      </h1>
      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
        สวัสดี, {name} — เลือกห้องและช่วงเวลาเป็นบล็อกละ 1 ชั่วโมง
        แล้วยืนยันเพื่อรับรหัส 6 หลักทางอีเมล
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section aria-labelledby="my-bookings">
            <h2
              id="my-bookings"
              className="text-base font-semibold tracking-tight text-ink"
            >
              การจองของฉัน
            </h2>
            <div className="panel mt-3 flex items-start gap-4 p-6">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ku-soft text-ku"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M8 3v4" />
                  <path d="M16 3v4" />
                  <path d="M3 10h18" />
                </svg>
              </span>
              <div>
                <p className="font-semibold text-ink">ยังไม่มีการจอง</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                  เมื่อจองห้องสำเร็จ ระบบจะส่งรหัส 6 หลักไปทางอีเมล
                  ใช้รหัสนี้ยืนยันกับเจ้าหน้าที่เพื่อรับกุญแจ
                  และรายการจองจะแสดงที่นี่พร้อมสถานะ
                </p>
              </div>
            </div>
          </section>

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
        </div>

        <div className="space-y-6">
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
              เวลาจองนับเป็นบล็อกละ 1 ชั่วโมง เช่น 08:30–09:30
            </p>
          </section>

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
        </div>
      </div>
    </main>
  );
}
