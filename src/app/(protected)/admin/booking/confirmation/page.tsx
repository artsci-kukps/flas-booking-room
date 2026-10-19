import BookingConfirmationView, {
  parseBookingCodes,
} from "@/components/booking/booking-confirmation-view";
import { requireAdmin } from "@/lib/auth/guards";
import { getBookingConfirmation, type BookingConfirmation } from "@/lib/booking/reservations";

/**
 * หน้ายืนยันการจองของแอดมิน — ใช้ตรรกะเดียวกับหน้าผู้ใช้
 * ต่างกันที่ตรวจสิทธิ์ผู้ดูแล และลิงก์กลับไปที่พื้นที่ /admin
 */
export default async function AdminBookingConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  const { code } = await searchParams;
  const codes = parseBookingCodes(code);

  const bookings = (
    await Promise.all(codes.map((code) => getBookingConfirmation(code, admin.id)))
  ).filter((booking): booking is BookingConfirmation => booking !== null);

  return (
    <BookingConfirmationView
      bookings={bookings}
      basePath="/admin/booking"
      historyPath="/admin/history"
    />
  );
}
