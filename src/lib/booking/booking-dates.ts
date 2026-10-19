import { parseBookingDate, shiftBookingDate } from "./day-availability";

/**
 * กรอบวันสำหรับจอง — ระบบเปิดให้จองล่วงหน้าได้ถึง "วันพรุ่งนี้" เท่านั้น (ticket T16-1)
 * แยกตรรกะกรอบวันออกมาเป็นฟังก์ชันบริสุทธิ์ เพื่อให้ทั้งหน้าผู้ใช้และหน้าแอดมิน
 * ใช้กรอบเดียวกันและทดสอบได้โดยไม่แตะฐานข้อมูล
 */

/** ป้ายของตัวเลือกวัน — ลำดับตรงกับจำนวนวันในกรอบ (วันนี้, วันพรุ่งนี้) */
const BOOKING_DATE_LABELS = ["วันนี้", "วันพรุ่งนี้"] as const;

/** ตัวเลือกวันหนึ่งรายการ — วันที่ (YYYY-MM-DD) พร้อมป้ายภาษาไทย */
export type BookingDateOption = {
  date: string;
  label: string;
};

/**
 * ตัวเลือกวันสำหรับจองของวันนี้ — คืนเพียงวันนี้และวันพรุ่งนี้เท่านั้น
 * ไม่มีตัวเลือกวันที่เกินกว่าวันพรุ่งนี้
 */
export function bookingDateOptions(today: string): BookingDateOption[] {
  return BOOKING_DATE_LABELS.map((label, ahead) => ({
    date: shiftBookingDate(today, ahead),
    label,
  }));
}

/** วันที่นั้นอยู่ในกรอบจอง (วันนี้หรือวันพรุ่งนี้) หรือไม่ */
export function isBookableDate(date: string, today: string): boolean {
  return date === today || date === shiftBookingDate(today, 1);
}

/**
 * อ่าน ?date= ของหน้าจอง แล้วปรับให้อยู่ในกรอบวันนี้–วันพรุ่งนี้เสมอ
 * - ค่าในกรอบ: คงไว้ตามเดิม
 * - ค่าที่เกินวันพรุ่งนี้ ก่อนวันนี้ ผิดรูปแบบ หรือไม่ได้ส่งมา: ใช้วันนี้แทน
 * จึงไม่มีทางแสดงหรือเลือกวันที่เกินกว่าวันพรุ่งนี้ได้ แม้แก้ URL เอง
 */
export function resolveBookableDate(
  value: string | string[] | null | undefined,
  today: string,
): string {
  const parsed = parseBookingDate(value);

  if (parsed && isBookableDate(parsed, today)) {
    return parsed;
  }

  return today;
}