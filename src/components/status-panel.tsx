import type { ReactNode } from "react";

type StatusPanelProps = {
  /** ไอคอนพร้อม — ใส่โทนสีของตัวเอง (เช่น text-danger) */
  icon: ReactNode;
  tone?: "neutral" | "danger";
  /** รหัสสถานะ เช่น 403 — แสดงใต้ไอคอน เหนือหัวข้อ */
  code?: string;
  title: string;
  body: string;
  action?: ReactNode;
};

/**
 * การ์ดสถานะกลางจอ — ใช้ร่วมกันระหว่างหน้า 403 และหน้าบัญชีถูกระงับ
 * ให้ทั้งสองหน้ามีโครงสร้างและจังหวะแบบเดียวกัน
 */
export default function StatusPanel({
  icon,
  tone = "neutral",
  code,
  title,
  body,
  action,
}: StatusPanelProps) {
  const circle =
    tone === "danger" ? "bg-danger-soft text-danger" : "bg-canvas text-ink-muted";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-6 py-12">
      <div className="panel w-full max-w-[26rem] p-8 text-center sm:p-10">
        <div
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${circle}`}
          aria-hidden="true"
        >
          {icon}
        </div>
        {code ? (
          <p className="mt-4 text-xs font-semibold tracking-[0.2em] text-ink-muted">
            {code}
          </p>
        ) : null}
        <h1
          className={`text-2xl font-semibold tracking-tight text-ink ${code ? "mt-1.5" : "mt-5"}`}
        >
          {title}
        </h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">
          {body}
        </p>
        {action}
      </div>
    </main>
  );
}
