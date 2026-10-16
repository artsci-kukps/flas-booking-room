/**
 * การ์ด "การจองของฉัน" — จุดแรกของหน้าจองห้อง บอกสถานะว่ายังไม่มีรายการ
 * และอธิบายว่ารหัส 6 หลักถูกส่งทางอีเมลเพื่อใช้รับกุญแจ
 * ใช้ร่วมกันระหว่างหน้าจองของผู้ใช้และของแอดมิน
 */
export default function MyBookingsSection() {
  return (
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
  );
}
