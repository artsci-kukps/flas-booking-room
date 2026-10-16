type PlaceholderPanelProps = {
  /** หัวข้อของการ์ด — บอกว่าหน้านี้จะทำอะไร */
  title?: string;
  /** รายการที่หน้านี้จะรองรับเมื่อพัฒนาเสร็จ */
  points: readonly string[];
};

/**
 * การ์ดบอกสถานะของหน้ายังไม่พัฒนา — ใช้ซ้ำทุกหน้าสแตบ
 * เพื่อให้โครงสร้างและจังหวะตรงกัน แล้วค่อยแทนด้วย UI จริงทีละหน้า
 */
export default function PlaceholderPanel({
  title = "หน้านี้อยู่ระหว่างพัฒนา",
  points,
}: PlaceholderPanelProps) {
  return (
    <section className="panel mt-8 p-6">
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-ku-soft text-ku"
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
            <path d="M14.7 6.3a4 4 0 0 0 5.3 5.3l-8.4 8.4a2.1 2.1 0 0 1-3-3l8.4-8.4a4 4 0 0 0-5.3-5.3l3 3-2.1 2.1-3-3" />
          </svg>
        </span>
        <div>
          <p className="font-semibold text-ink">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            ฟังก์ชันที่จะรองรับในหน้านี้ ตามขอบเขตที่กำหนดไว้ใน TOR
          </p>
        </div>
      </div>

      <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
        {points.map((point) => (
          <li key={point} className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-ku"
            />
            <span className="text-sm leading-relaxed text-ink-muted">
              {point}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
