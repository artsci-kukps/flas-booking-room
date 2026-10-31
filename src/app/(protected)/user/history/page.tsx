import { requireUser } from "@/lib/auth/guards";
import { listMyBookings } from "@/lib/booking/my-bookings";

import BookingHistory from "./booking-history";

/**
 * การจองของฉัน — ประวัติการจองทั้งหมดของผู้ใช้ พร้อมรหัสและสถานะ (TOR ข้อ 6.3, 6.4)
 * ยกเลิกเองได้เฉพาะ PENDING ก่อนเวลาเริ่ม; เมื่อ ACTIVE แล้วต้องคืนกุญแจก่อน
 * ตัวตน/สิทธิ์ถูกตรวจด้วย requireUser() ในหน้า และพื้นที่ /user ถูกกันด้วย layout อีกชั้น
 */
export default async function HistoryPage() {
  const user = await requireUser();
  const bookings = await listMyBookings(user.id);

  return <BookingHistory bookings={bookings} />;
}
