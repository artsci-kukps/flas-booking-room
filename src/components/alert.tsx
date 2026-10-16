import type { ReactNode } from "react";

export type AlertTone = "danger" | "success" | "warning" | "info";

type ToneStyle = {
  box: string;
  heading: string;
  body: string;
  icon: string;
  role: "alert" | "status";
};

/**
 * โทนสีทั้งหมดอ้างจาก globals.css เท่านั้น (Named-Not-Shaded Rule)
 * - danger  = danger-soft + danger-line (โทนเดียวที่มีเส้นขอบสีกำกับ ตาม DESIGN.md)
 * - warning = amber-soft (amber สงวนไว้กับความหมาย "ไม่ว่าง/ต้องระวัง")
 * - success = ku-soft (เขียวแบรนด์ = ผ่าน/สำเร็จ)
 * - info    = โทนกลาง canvas + ink-muted เพราะน้ำเงิน/ม่วงเป็น "สีหมวดหมู่ห้อง"
 *             ไม่ใช่สีเน้น จึงไม่นำมาใช้กับข้อความแจ้งเตือน
 */
const TONES: Record<AlertTone, ToneStyle> = {
  danger: {
    box: "border-danger-line bg-danger-soft",
    heading: "text-danger",
    body: "text-danger",
    icon: "text-danger",
    role: "alert",
  },
  warning: {
    box: "border-border bg-amber-soft",
    heading: "text-amber-ink",
    body: "text-amber-ink",
    icon: "text-amber",
    role: "alert",
  },
  success: {
    box: "border-border bg-ku-soft",
    heading: "text-ku",
    body: "text-ku",
    icon: "text-ku",
    role: "status",
  },
  info: {
    box: "border-border bg-canvas",
    heading: "text-ink",
    body: "text-ink-muted",
    icon: "text-ink-muted",
    role: "status",
  },
};

/** ไอคอนเขียนเองทุกใบ น้ำหนักเส้น 1.8 เท่ากับไอคอนอื่นทั้งระบบ (ห้ามใช้ emoji/icon font) */
function ToneIcon({ tone, className }: { tone: AlertTone; className: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  if (tone === "success") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M8.5 12.2l2.4 2.4 4.6-4.8" />
      </svg>
    );
  }

  if (tone === "warning") {
    return (
      <svg {...common}>
        <path d="M12 4.5l8.5 15h-17l8.5-15Z" />
        <path d="M12 10v4" />
        <path d="M12 17h.01" />
      </svg>
    );
  }

  if (tone === "info") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5" />
        <path d="M12 8h.01" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5" />
      <path d="M12 16h.01" />
    </svg>
  );
}

type AlertProps = {
  /** โทนของข้อความแจ้ง — ค่าเริ่มต้นเป็น danger ให้ตรงกับกรณีผิดพลาดที่ใช้บ่อยที่สุด */
  tone?: AlertTone;
  /** หัวข้อสั้น ๆ (14px ตัวหนา) */
  heading: string;
  /** เนื้อความ (13px) — ใช้ `children` แทนได้เมื่อต้องแทรกองค์ประกอบอื่น */
  body?: string;
  children?: ReactNode;
  /** ปุ่มหรือลิงก์ท้ายข้อความ (ถ้ามี) */
  action?: ReactNode;
  className?: string;
};

/**
 * Global Alert — ข้อความแจ้งเตือนแบบ inline ของทั้งระบบ
 * flat ตาม DESIGN.md: radius 14px, 1px ขอบ, ไม่มีเงา, static (ไม่ปิดเอง/ไม่ auto-dismiss)
 */
export default function Alert({
  tone = "danger",
  heading,
  body,
  children,
  action,
  className,
}: AlertProps) {
  const style = TONES[tone];

  return (
    <div
      role={style.role}
      className={`flex gap-3 rounded-[14px] border p-4 text-left ${style.box}${className ? ` ${className}` : ""}`}
    >
      <ToneIcon tone={tone} className={`mt-0.5 h-5 w-5 shrink-0 ${style.icon}`} />
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${style.heading}`}>{heading}</p>
        {body ? (
          <p className={`mt-1 text-[0.8125rem] leading-relaxed ${style.body}`}>
            {body}
          </p>
        ) : null}
        {children ? (
          <div className={`text-[0.8125rem] leading-relaxed ${style.body}`}>
            {children}
          </div>
        ) : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}
