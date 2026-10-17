import type { ReactNode, SelectHTMLAttributes } from "react";

type FieldSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
};

/**
 * ดропดาวน์ของระบบ — ใช้ `.field` ร่วมกับ `.field-select`
 * วาด chevron เอง (เส้น 1.8 เท่ากับไอคอนอื่น) เพราะปิดลูกศรเนทีฟไปแล้ว
 * ไม่มีเงา ตาม Flat-By-Default
 */
export default function FieldSelect({ children, className, ...props }: FieldSelectProps) {
  return (
    <div className="relative">
      <select {...props} className={`field field-select${className ? ` ${className}` : ""}`}>
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}
