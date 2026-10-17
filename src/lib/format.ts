/**
 * ตัวช่วยจัดรูปแบบที่ใช้ร่วมกันหลายหน้าจอ
 */

/** วันที่/เวลาแบบไทย เขตเวลาไทย (ระบบคิดเวลา Asia/Bangkok) */
export function formatThaiDateTime(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(date);
}
