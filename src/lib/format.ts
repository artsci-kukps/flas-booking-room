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

/** วันที่จากสตริง YYYY-MM-DD (คอลัมน์ date ของ PG) เป็นวันที่ไทย เขตเวลาไทย */
export function formatThaiDate(isoDate: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}
