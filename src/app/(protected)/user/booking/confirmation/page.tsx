import Link from "next/link";

import Alert from "@/components/alert";
import RoomTypeCodeBadge from "@/components/room-type-code-badge";
import { requireUser } from "@/lib/auth/guards";
import { getBookingConfirmation } from "@/lib/booking/reservations";
import { formatBangkokTime, formatThaiDate } from "@/lib/format";

/**
 * หน้ายืนยันการจอง — แสดงหลัง bookRoom สำเร็จ (?code= รหัสการจอง 6 หลัก)
 * อ่านการจองด้วยรหัส + user id ของผู้เรียกเท่านั้น จึงเปิดดูรหัสของคนอื่นไม่ได้
 * การส่งรหัสทางอีเมลเป็นส่วนเสริมของ ticket #14 — หน้านี้แสดงรหัสบนจอเสมอ ไม่พึ่งอีเมล
 */

const CODE_PATTERN = /^\d{6}$/;

/** สถานะที่หน้านี้อาจพบ — ผู้ใช้เพิ่งจองจึงเห็น PENDING เป็นหลัก */
const STATUS_LABEL: Record<string, string> = {
  PENDING: "จองแล้ว รอรับกุญแจ",
  ACTIVE: "กำลังใช้งาน",
  COMPLETED: "เสร็จสิ้น",
  LATE_RETURN: "คืนกุญแจช้า",
  CANCELLED: "ยกเลิกแล้ว",
  NO_SHOW: "ไม่มาแสดงตัว",
};

function NotFoundPanel() {
  return (
    <main className="page py-8 sm:py-10">
      <div className="max-w-2xl">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
          หน้ายืนยันการจอง
        </h1>
        <Alert
          tone="danger"
          heading="ไม่พบรหัสการจอง"
          body="รหัสไม่ถูกต้องหรือไม่ใช่การจองของคุณ กรุณาตรวจสอบรหัสอีกครั้ง"
          className="mt-6"
        />
        <Link href="/user/booking" className="btn btn-outline mt-6">
          กลับไปหน้าจองห้อง
        </Link>
      </div>
    </main>
  );
}

export default async function BookingConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();

  const { code: rawCode } = await searchParams;
  const code = Array.isArray(rawCode) ? rawCode[0] : rawCode;

  const booking =
    code && CODE_PATTERN.test(code)
      ? await getBookingConfirmation(code, user.id)
      : null;

  if (!booking) {
    return <NotFoundPanel />;
  }

  return (
    <main className="page py-8 sm:py-10">
      <div className="max-w-2xl">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
          จองสำเร็จ
        </h1>
        <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
          ยืนยันการจองห้องเรียบร้อยแล้ว — เก็บรหัสด้านล่างไว้และแสดงกับเจ้าหน้าที่
          ณ จุดรับกุญแจ
        </p>

        <section className="panel mt-6 p-6 sm:p-8" aria-labelledby="booking-code-label">
          <p
            id="booking-code-label"
            className="text-xs font-semibold tracking-[0.2em] text-ink-muted"
          >
            รหัสการจอง
          </p>
          <p className="mt-2 text-[2.5rem] font-semibold tabular-nums leading-none tracking-[0.25em] text-ink">
            {booking.bookingCode}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-5">
            <RoomTypeCodeBadge code={booking.roomTypeCode} />
            <div className="min-w-0">
              <p className="text-base font-semibold text-ink">{booking.roomName}</p>
              <p className="mt-0.5 text-sm text-ink-muted">
                {formatThaiDate(booking.bookingDate)} · {formatBangkokTime(booking.startTime)}
                {"–"}
                {formatBangkokTime(booking.endTime)} น.
              </p>
            </div>
          </div>

          <p className="mt-4 text-sm font-medium text-ku">
            สถานะ: {STATUS_LABEL[booking.status] ?? booking.status}
          </p>
        </section>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/user/booking" className="btn btn-outline">
            จองห้องอื่น
          </Link>
          <Link href="/user/history" className="btn btn-outline">
            ดูการจองของฉัน
          </Link>
        </div>
      </div>
    </main>
  );
}
