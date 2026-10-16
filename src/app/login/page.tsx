import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/guards";
import BrandMark from "@/components/brand-mark";
import GoogleSignInButton from "./google-sign-in-button";

// ข้อความแจ้งเมื่อเข้าสู่ระบบไม่สำเร็จ (คีย์มาจาก query string ?error=)
const ERROR_NOTICES = {
  "ku-domain": {
    heading: "บัญชีนี้ใช้ไม่ได้",
    body: "ระบบอนุญาตเฉพาะอีเมล @ku.th กรุณาเข้าสู่ระบบใหม่ด้วยบัญชีอีเมลมหาวิทยาลัยของคุณ",
  },
  session: {
    heading: "เข้าสู่ระบบไม่สำเร็จ",
    body: "เกิดข้อผิดพลาดระหว่างเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง",
  },
} as const;

type PlateStatus = "free" | "busy" | "full";
type RoomCode = "S" | "G" | "P";

// ตัวอย่างผนังป้ายห้อง — ค่าตัวอย่างจนกว่าจะผูกกับตาราง rooms จริง
// (หน้าอีเมลเข้าสู่ระบบยังไม่มีสิทธิ์อ่านข้อมูลห้องจริง จึงติดป้ายกำกับไว้ชัดเจน)
const ROOM_PLATES: readonly {
  code: string;
  name: string;
  type: RoomCode;
  status: PlateStatus;
  note: string;
}[] = [
  { code: "S-204", name: "ห้องนั่งทำงาน", type: "S", status: "free", note: "ว่าง 4 ที่นั่ง" },
  { code: "G-101", name: "ห้องประชุมใหญ่", type: "G", status: "busy", note: "ใช้งานถึง 15:30" },
  { code: "P-012", name: "ห้องละหมาด", type: "P", status: "free", note: "ว่าง" },
  { code: "S-205", name: "ห้องนั่งทำงาน", type: "S", status: "free", note: "ว่าง 6 ที่นั่ง" },
  { code: "S-206", name: "ห้องนั่งทำงาน", type: "S", status: "full", note: "เต็ม" },
  { code: "G-102", name: "ห้องประชุมใหญ่", type: "G", status: "free", note: "ว่าง" },
];

// สีของป้ายสถานะ — ว่าง = เขียวแบรนด์, ไม่ว่าง = amber, เต็ม = กลาง
// "เต็ม" ใช้พื้นเทาเรียบกว่าเพื่อลดความเด่น แต่คงเส้นขอบไว้ให้ยังอ่านเป็นป้าย
const STATUS_CHIP: Record<PlateStatus, string> = {
  free: "bg-ku-soft text-ku",
  busy: "bg-amber-soft text-amber-ink",
  full: "border border-border bg-canvas text-ink-muted",
};

const STATUS_DOT: Record<PlateStatus, string> = {
  free: "bg-ku",
  busy: "bg-amber",
  full: "bg-ink-muted",
};

// สีของกระเบื้องประเภทห้อง — ตรงกับ RoomTypesSection ทั้งระบบ
const TYPE_TILE: Record<RoomCode, string> = {
  S: "bg-ku",
  G: "bg-blue",
  P: "bg-violet",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect(user.role === "admin" ? "/admin/dashboard" : "/user/booking");
  }

  const { error } = await searchParams;
  const notice =
    error === "ku-domain" || error === "session" ? ERROR_NOTICES[error] : null;

  return (
    <main className="flex min-h-dvh flex-col bg-canvas lg:grid lg:grid-cols-[1.06fr_0.94fr]">
      {/* ---------- ฝั่งซ้าย: ผนังป้ายห้องของคณะ ---------- */}
      <section className="order-2 flex flex-col border-t border-border px-6 py-10 sm:px-8 lg:order-1 lg:min-h-dvh lg:border-r lg:border-t-0 lg:px-14 lg:py-14">
        <div className="flex items-center gap-3">
          <BrandMark size="lg" />
          <div className="min-w-0">
            <p className="text-[0.9375rem] font-semibold tracking-tight text-ink">
              Creative Space
            </p>
            <p className="text-[0.8125rem] leading-snug text-ink-muted">
              คณะศิลปศาสตร์และวิทยาศาสตร์ · มหาวิทยาลัยเกษตรศาสตร์ วิทยาเขตกำแพงแสน
            </p>
          </div>
        </div>

        <div className="mt-12 max-w-[46ch] lg:mt-16">
          <h1 className="text-[2.5rem] font-bold leading-[0.98] tracking-[-0.03em] text-ink sm:text-[3.25rem] lg:text-[4.25rem]">
            ห้องว่าง<span className="text-ku">ในคณะ</span> พร้อมให้คุณ
          </h1>
          <p className="mt-5 text-base leading-relaxed text-ink-muted">
            ระบบจองห้องทำงานรายชั่วโมง สำหรับบุคลากรมหาวิทยาลัยเกษตรศาสตร์
            เลือกห้อง เลือกบล็อกเวลา แล้วมารับกุญแจที่เคาน์เตอร์
          </p>
        </div>

        <div className="mt-10 lg:mt-auto lg:pt-12">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="text-[0.8125rem] font-semibold text-ink-muted">
              ห้องในระบบ
            </h2>
            <p className="text-[0.75rem] text-ink-muted">
              ตัวอย่างข้อมูล · สถานะจริงแสดงหลังเข้าสู่ระบบ
            </p>
          </div>

          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {ROOM_PLATES.map((room) => (
              <li
                key={room.code}
                className="rounded-plate border border-border bg-surface p-4"
              >
                <p className="text-[1.375rem] font-bold tracking-[-0.02em] tabular-nums text-ink">
                  {room.code}
                </p>
                <p className="mt-0.5 text-[0.8125rem] leading-snug text-ink-muted">
                  {room.name}
                </p>
                <div className="mt-3.5 flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CHIP[room.status]}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[room.status]}`}
                    />
                    {room.note}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] text-sm font-bold text-white ${TYPE_TILE[room.type]}`}
                  >
                    {room.type}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- ฝั่งขวา: ประตูเข้าสู่ระบบ ---------- */}
      <aside className="order-1 flex items-center justify-center px-6 py-12 sm:px-8 lg:order-2 lg:min-h-dvh lg:px-12 lg:py-16">
        <div className="rounded-card w-full max-w-[26rem] border border-border bg-surface p-8 sm:p-10">
          {/* มือถือ: การ์ดมาก่อนผนัง จึงต้องมีแบรนด์ให้เห็นตรงจุดตัดสินใจเข้าสู่ระบบ
              จอใหญ่ซ่อน เพราะมีล็อกอัปแบรนด์อยู่หัวคอลัมน์ซ้ายแล้ว */}
          <div className="mb-6 flex items-center gap-3 border-b border-border pb-6 lg:hidden">
            <BrandMark />
            <div className="min-w-0">
              <p className="text-[0.9375rem] font-semibold tracking-tight text-ink">
                Creative Space
              </p>
              <p className="text-[0.8125rem] leading-snug text-ink-muted">
                คณะศิลปศาสตร์และวิทยาศาสตร์
              </p>
            </div>
          </div>

          <h2 className="text-[1.75rem] font-bold tracking-[-0.03em] text-ink sm:text-[2rem]">
            เข้าสู่ระบบ
          </h2>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">
            เข้าสู่ระบบด้วยบัญชีอีเมลมหาวิทยาลัย (@ku.th)
            เพื่อจองห้องและติดตามการจองของคุณ
          </p>

          {notice ? (
            <div
              role="alert"
              className="mt-6 flex gap-3 rounded-[14px] border border-danger-line bg-danger-soft p-4 text-left"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mt-0.5 h-5 w-5 shrink-0 text-danger"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7.5v5" />
                <path d="M12 16h.01" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-danger">
                  {notice.heading}
                </p>
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-danger">
                  {notice.body}
                </p>
              </div>
            </div>
          ) : null}

          <div className="mt-6">
            <GoogleSignInButton />
          </div>

          <p className="mt-5 flex items-center justify-center gap-1.5 text-[0.8125rem] text-ink-muted">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 shrink-0"
              aria-hidden="true"
            >
              <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
              <path d="M9.5 12l1.8 1.8 3.5-3.6" />
            </svg>
            อนุญาตเฉพาะอีเมลที่ลงท้ายด้วย @ku.th
          </p>

          <div className="mt-6 flex items-baseline justify-between gap-4 border-t border-border pt-4">
            <span className="text-[0.8125rem] text-ink-muted">
              เวลาให้บริการ
            </span>
            <span className="text-[0.8125rem] font-semibold tabular-nums text-ink">
              จันทร์–ศุกร์ 08:30–16:30
            </span>
          </div>
        </div>
      </aside>
    </main>
  );
}
