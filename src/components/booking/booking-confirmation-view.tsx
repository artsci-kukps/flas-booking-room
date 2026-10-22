import Link from "next/link";

import Alert from "@/components/alert";
import RoomTypeCodeBadge from "@/components/room-type-code-badge";
import type { BookingConfirmation } from "@/lib/booking/reservations";
import { formatBangkokTime, formatThaiDate } from "@/lib/format";

/**
 * หน้ายืนยันการจอง — แสดงหลังจองสำเร็จ (?code= หนึ่งครั้งต่อหนึ่ง record)
 * ใช้ร่วมกันทั้งหน้าผู้ใช้และแอดมิน โดยรับ basePath ของพื้นที่มาใส่ลิงก์
 * (การอ่านข้อมูล/ตรวจสิทธิ์อยู่ในหน้า page ของแต่ละพื้นที่)
 */

const CODE_PATTERN = /^\d{6}$/;

/** แยกค่า ?code= ที่ส่งมาหนึ่งหรือหลายค่า เป็นรหัสที่รูปแบบถูกต้องและไม่ซ้ำ */
export function parseBookingCodes(rawCode: string | string[] | undefined): string[] {
  const values = Array.isArray(rawCode) ? rawCode : rawCode ? [rawCode] : [];

  return [...new Set(values.filter((code) => CODE_PATTERN.test(code)))];
}

function NotFoundPanel({ basePath }: { basePath: string }) {
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
        <Link href={basePath} className="btn btn-outline mt-6">
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
            {formatBangkokTime(booking.endTime)}
          </p>
        </div>
      </div>
    </section>
  );
}

type BookingConfirmationViewProps = {
  bookings: BookingConfirmation[];
  /** ฐานเส้นทางของพื้นที่ เช่น '/user/booking' หรือ '/admin/booking' */
  basePath: string;
  /** หน้าประวัติการจองของพื้นที่ เช่น '/user/history' */
  historyPath: string;
};

export default function BookingConfirmationView({
  bookings,
  basePath,
  historyPath,
}: BookingConfirmationViewProps) {
  if (bookings.length === 0) {
    return <NotFoundPanel basePath={basePath} />;
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
          <Link href={basePath} className="btn btn-outline">
            จองห้องอื่น
          </Link>
          <Link href={historyPath} className="btn btn-outline">
            ดูการจองของฉัน
          </Link>
        </div>
      </div>
    </main>
  );
}
