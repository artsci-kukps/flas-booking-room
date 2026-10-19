import { requireAdmin } from "@/lib/auth/guards";
import { getBookingConfirmation, type BookingConfirmation } from "@/lib/booking/reservations";

import {
  BookingConfirmationNotFound,
  BookingConfirmationView,
} from "@/components/booking/booking-confirmation";

/**
 * หน้ายืนยันการจองของแอดมิน — ปลายทางหลังแอดมินจองห้องจาก /admin/booking
 * ใช้เนื้อหาหน้าร่วมกับฝั่งผู้ใช้ (ดู components/booking/booking-confirmation.tsx)
 * แต่ลิงก์กลับไปหน้าจองและประวัติเป็นเส้นทางของพื้นที่แอดมิน
 */

const CODE_PATTERN = /^\d{6}$/;

/** แยกค่า ?code= ที่ส่งมาหนึ่งหรือหลายค่า เป็นรหัสที่รูปแบบถูกต้องและไม่ซ้ำ */
function parseCodes(rawCode: string | string[] | undefined): string[] {
  const values = Array.isArray(rawCode) ? rawCode : rawCode ? [rawCode] : [];

  return [...new Set(values.filter((code) => CODE_PATTERN.test(code)))];
}

export default async function AdminBookingConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();

  const { code: rawCode } = await searchParams;
  const codes = parseCodes(rawCode);

  const resolved = await Promise.all(
    codes.map((code) => getBookingConfirmation(code, admin.id)),
  );
  const bookings = resolved.filter(
    (booking): booking is BookingConfirmation => booking !== null,
  );

  if (bookings.length === 0) {
    return <BookingConfirmationNotFound bookingPath="/admin/booking" />;
  }

  return (
    <BookingConfirmationView
      bookings={bookings}
      bookingPath="/admin/booking"
      historyPath="/admin/history"
    />
  );
}