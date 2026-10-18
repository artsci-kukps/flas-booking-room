/**
 * ตัวช่วยเวลาแบบบริสุทธิ์ (หน้าปัด 'HH:MM') — โมดูลที่ไม่แตะฐานข้อมูล
 * จึง import ได้ทั้งฝั่ง server และ client component
 *
 * ใช้ร่วมกันระหว่างการสร้างช่องว่างของวัน (day-availability) การรวมบล็อกเป็น record
 * (booking-plan) และการคำนวณระยะเวลาขั้นต่ำตอนบันทึก (reservations)
 */

/** เวลาในรูป 'HH:MM' หรือ 'HH:MM:SS' (คอลัมน์ time ของ PG อาจคืนวินาที) */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/** ระยะเวลาของหนึ่งช่องว่าง/บล็อก (TOR ข้อ 5.3: บล็อกละ 1 ชั่วโมง) */
export const SLOT_DURATION_MINUTES = 60;

/** 'HH:MM' หรือ 'HH:MM:SS' → นาทีนับจากเที่ยงคืน (null เมื่อรูปแบบไม่ถูกต้อง) */
export function timeToMinutes(time: string): number | null {
  if (!TIME_PATTERN.test(time)) {
    return null;
  }

  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);

  return hours! * 60 + minutes!;
}

/** นาทีนับจากเที่ยงคืน → 'HH:MM' */
export function minutesToTime(total: number): string {
  const hours = Math.floor(total / 60) % 24;
  const minutes = total % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
