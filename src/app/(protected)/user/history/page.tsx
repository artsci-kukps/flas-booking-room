import Link from "next/link";

import RoomTypeCodeBadge from "@/components/room-type-code-badge";
import { requireUser } from "@/lib/auth/guards";
import { formatBangkokTime, formatThaiDate, formatThaiDateTime } from "@/lib/format";
import { listMyBookings, type BookingStatus } from "@/lib/booking/my-bookings";

import CancelBookingButton from "./cancel-booking-button";

/**
 * การจองของฉัน — ประวัติการจองทั้งหมดของผู้ใช้ พร้อมรหัสและสถานะ (TOR ข้อ 6.3, 6.4)
 * ยกเลิกเองได้เฉพาะ PENDING ก่อนเวลาเริ่ม; เมื่อ ACTIVE แล้วต้องคืนกุญแจก่อน
 * ตัวตน/สิทธิ์ถูกตรวจด้วย requireUser() ในหน้า และพื้นที่ /user ถูกกันด้วย layout อีกชั้น
 */

const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: "จองแล้ว รอรับกุญแจ",
  ACTIVE: "กำลังใช้งาน",
  COMPLETED: "เสร็จสิ้น",
  LATE_RETURN: "คืนกุญแจช้า",
  CANCELLED: "ยกเลิกแล้ว",
  NO_SHOW: "ไม่มาแสดงตัว",
};

export default async function HistoryPage() {
  const user = await requireUser();
  const bookings = await listMyBookings(user.id);

  return (
    <main className="page py-8 sm:py-10">
      <div className="max-w-2xl">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
          การจองของฉัน
        </h1>
        <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
          รายการจองทั้งหมดของคุณ พร้อมรหัส 6 หลักและสถานะ —
          ยกเลิกเองได้เฉพาะก่อนถึงเวลาเริ่มและยังไม่ได้รับกุญแจ
        </p>
      </div>

      {bookings.length === 0 ? (
        <section className="panel mt-8 p-6">
          <p className="font-semibold text-ink">ยังไม่มีการจอง</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            เมื่อจองห้องสำเร็จ รายการจะแสดงที่นี่พร้อมรหัส 6 หลักและสถานะ
          </p>
          <Link href="/user/booking" className="btn btn-outline mt-4">
            ไปหน้าจองห้อง
          </Link>
        </section>
      ) : (
        <ul className="mt-8 grid gap-4">
          {bookings.map((booking) => (
            <li key={booking.id} className="panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <RoomTypeCodeBadge code={booking.roomTypeCode} />
                    <p className="text-base font-semibold text-ink">{booking.roomName}</p>
                  </div>
                  <p className="mt-1.5 text-sm text-ink-muted">
                    {formatThaiDate(booking.bookingDate)} ·{" "}
                    {formatBangkokTime(booking.startTime)}–
                    {formatBangkokTime(booking.endTime)} น.
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    รหัสการจอง{" "}
                    <span className="font-semibold tabular-nums tracking-wider text-ink">
                      {booking.bookingCode}
                    </span>
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-medium text-ku">{STATUS_LABEL[booking.status]}</p>
                  {booking.status === "CANCELLED" && booking.canceledAt ? (
                    <p className="mt-0.5 text-xs text-ink-muted">
                      ยกเลิกเมื่อ {formatThaiDateTime(booking.canceledAt)}
                    </p>
                  ) : null}
                </div>
              </div>

              {booking.canCancel ? (
                <div className="mt-4 border-t border-border pt-4">
                  <CancelBookingButton bookingId={booking.id} />
                </div>
              ) : booking.status === "ACTIVE" && booking.cancelBlockedMessage ? (
                <p className="mt-4 border-t border-border pt-4 text-sm text-ink-muted">
                  {booking.cancelBlockedMessage}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
