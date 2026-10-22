/**
 * ตัวช่วยอ่านค่า FormData ของ server actions — แหล่งความจริงเดียว
 * ทุกฟอร์มใช้การ trim แบบเดียวกัน และใช้ข้อความ "ไม่พบ id" แบบเดียวกัน
 */

/** ข้อความเมื่อฟอร์มไม่มี id (เช่น ผู้ใช้กดส่งฟอร์มเก่าหลังรีเฟรชหน้า) */
export const MISSING_ID_MESSAGE = "ไม่พบรายการที่ต้องการ กรุณารีเฟรชหน้าแล้วลองใหม่";

/** อ่านค่าจากฟิลด์แล้วตัดช่องว่างหัวท้าย — คืน "" เมื่อไม่มีฟิลด์นั้น */
export function readField(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** อ่านค่า id จากฟอร์ม (คือ readField ของคีย์ "id") */
export function readId(formData: FormData): string {
  return readField(formData, "id");
}
