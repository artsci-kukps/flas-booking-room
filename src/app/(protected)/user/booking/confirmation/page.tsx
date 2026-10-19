import BookingConfirmationView, {
  parseBookingCodes,
} from "@/components/booking/booking-confirmation-view";
import { requireUser } from "@/lib/auth/guards";
import { getBookingConfirmation, type BookingConfirmation } from "@/lib/booking/reservations";

/**
 * หน้ายืนยันการจองของผู้ใช้ — อ่านการจองด้วยรหัส + user id ของผู้เรียกเท่านั้น
 * จึงเปิดดูรหัสของคนอื่นไม่ได้ (เนื้อการแสดงผลอยู่ที่ BookingConfirmationView)
 */
export default async function BookingConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const { code } = await searchParams;
  const codes = parseBookingCodes(code);

  const results = await Promise.all(
    codes.map((code) => getBookingConfirmation(code, user.id)),
  );
  const bookings = results.filter(
    (booking): booking is BookingConfirmation => booking !== null,
  );

  return (
    <BookingConfirmationView
      bookings={bookings}
      basePath="/user/booking"
      historyPath="/user/history"
    />
  );
}
