import { requireUser } from "@/lib/auth/guards";
import { getBookingConfirmation, type BookingConfirmation } from "@/lib/booking/reservations";

import {
  BookingConfirmationNotFound,
  BookingConfirmationView,
} from "@/components/booking/booking-confirmation";

/**
 * หน้ายืนยันการจองของผู้ใช้ — แสดงหลัง bookRoom สำเร็จ (?code= หนึ่งครั้งต่อหนึ่ง record)
 * จองหลายช่องที่มีช่วงห่างกันจะได้หลาย record (หลายรหัส) — หน้านี้แสดงทุก record
 * เนื้อหาหน้าร่วมกับฝั่งแอดมิน (ดู components/booking/booking-confirmation.tsx)
 */

const CODE_PATTERN = /^\d{6}$/;

/** แยกค่า ?code= ที่ส่งมาหนึ่งหรือหลายค่า เป็นรหัสที่รูปแบบถูกต้องและไม่ซ้ำ */
function parseCodes(rawCode: string | string[] | undefined): string[] {
  const values = Array.isArray(rawCode) ? rawCode : rawCode ? [rawCode] : [];

  return [...new Set(values.filter((code) => CODE_PATTERN.test(code)))];
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
    return <BookingConfirmationNotFound bookingPath="/user/booking" />;
  }

  return (
    <BookingConfirmationView
      bookings={bookings}
      bookingPath="/user/booking"
      historyPath="/user/history"
    />
  );
}