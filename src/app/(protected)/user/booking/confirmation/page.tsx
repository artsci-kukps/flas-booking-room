import Link from "next/link";

import Alert from "@/components/alert";
import RoomTypeCodeBadge from "@/components/room-type-code-badge";
import { requireUser } from "@/lib/auth/guards";
import { getBookingConfirmation, type BookingConfirmation } from "@/lib/booking/reservations";
import { RESERVATION_STATUS_LABEL } from "@/lib/booking/reservation-status";
import { formatBangkokTime, formatThaiDate } from "@/lib/format";

/**
 * หน้ายืนยันการจอง — แสดงหลัง bookRoom สำเร็จ (?code= หนึ่งครั้งต่อหนึ่ง record)
 * จองหลายช่องที่มีช่วงห่างกันจะได้หลาย record (หลายรหัส) — หน้านี้แสดงทุก record
 * พร้อมจำนวนครั้งที่ต้องยืนยันกับเจ้าหน้าที่
 * อ่านการจองด้วยรหัส + user id ของผู้เรียกเท่านั้น จึงเปิดดูรหัสของคนอื่นไม่ได้
 * การส่งรหัสทางอีเมลเป็นส่วนเสริมของ ticket #14 — หน้านี้แสดงรหัสบนจอเสมอ ไม่พึ่งอีเมล
 */

const CODE_PATTERN = /^\d{6}$/;

/** แยกค่า ?code= ที่ส่งมาหนึ่งหรือหลายค่า เป็นรหัสที่รูปแบบถูกต้องและไม่ซ้ำ */
function parseCodes(rawCode: string | string[] | undefined): string[] {
  const values = Array.isArray(rawCode) ? rawCode : rawCode ? [rawCode] : [];

  return [...new Set(values.filter((code) => CODE_PATTERN.test(code)))];
}

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

function BookingCard({ booking }: { booking: BookingConfirmation }) {
  return (
    <section className="panel p-6 sm:p-8" aria-label={`รหัสการจอง ${booking.bookingCode}`}>
      <p className="text-xs font-semibold tracking-[0.2em] text-ink-muted">รหัสการจอง</p>
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
        สถานะ: {RESERVATION_STATUS_LABEL[booking.status]}
      </p>
    </section>
  );
}

export default async function BookingConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();

  const { code: rawCode } = await searchParams;
  const codes = parseCodes(rawCode);

  const resolved = await Promise.all(
    codes.map((code) => getBookingConfirmation(code, user.id)),
  );
  const bookings = resolved.filter(
    (booking): booking is BookingConfirmation => booking !== null,
  );

  if (bookings.length === 0) {
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

        <p className="mt-4 text-sm font-semibold text-ku">
          ต้องยืนยันกับเจ้าหน้าที่ {bookings.length} ครั้ง
        </p>

        <div className="mt-6 space-y-6">
          {bookings.map((booking) => (
            <BookingCard key={booking.bookingCode} booking={booking} />
          ))}
        </div>

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
