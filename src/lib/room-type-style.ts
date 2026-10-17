/**
 * สีประจำรหัสประเภทห้อง — แหล่งความจริงเดียวที่ทั้งป้ายรหัสและหน้ารายการประเภทห้องใช้
 * สีน้ำเงิน/ม่วงเป็น "สีจำแนกประเภท" ไม่ใช่สีเน้น (ตาม DESIGN.md) จึงใช้เฉพาะป้ายรหัส
 * รหัสอื่นนอกจากนี้ใช้โทนหมึกกลาง ๆ เพื่อไม่ให้เกิดสีที่มีความหมายกำกวม
 */
const ROOM_TYPE_BADGE_CLASS: Record<string, string> = {
  S: "bg-ku text-white",
  G: "bg-blue text-white",
  P: "bg-violet text-white",
};

/** คลาสพื้นหลัง/ตัวอักษรของป้ายรหัสประเภทห้อง */
export function roomTypeBadgeClass(code: string): string {
  return ROOM_TYPE_BADGE_CLASS[code] ?? "bg-ink text-white";
}
