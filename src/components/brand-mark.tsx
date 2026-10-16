type BrandMarkProps = {
  size?: "sm" | "lg";
  className?: string;
};

/**
 * สัญลักษณ์ระบบ (ประตูกับลูกบิด) — ใช้ซ้ำที่หัวกระดาษและหน้าเข้าสู่ระบบ
 * เส้น stroked 1.8 เหมือนกับไอคอนอื่นทุกใบในระบบ
 */
export default function BrandMark({ size = "sm", className }: BrandMarkProps) {
  const box =
    size === "lg" ? "h-11 w-11 rounded-[10px]" : "h-8 w-8 rounded-[9px]";
  const icon = size === "lg" ? "h-6 w-6" : "h-[18px] w-[18px]";

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center bg-ku text-white ${box}${className ? ` ${className}` : ""}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={icon}
      >
        <path d="M6 20V7a6 6 0 0 1 12 0v13" />
        <path d="M4 20h16" />
        <circle cx="12" cy="11" r="1.4" />
        <path d="M12 12.4v2.6" />
      </svg>
    </span>
  );
}
