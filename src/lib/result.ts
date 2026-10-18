/**
 * ผลลัพธ์มาตรฐานของชั้นข้อมูล/เซิร์ฟเวอร์แอ็กชัน — รูปเดียวกันทั้งระบบ
 *
 * - สำเร็จ: `{ ok: true }` รวมกับ payload ของแต่ละโดเมน (ค่าเริ่มต้น: ไม่มี payload)
 * - ล้มเหลว: `{ ok: false; message: string }` ข้อความไทยพร้อมแสดง inline
 *
 * เป็น generic เพื่อให้แต่ละโมดูลแคบ payload ของตัวเองได้ (เช่น bookingCode)
 * โดยไม่ต้องนิยามยูเนียน { ok: true } | { ok: false; message } ซ้ำทุกไฟล์
 *
 * หมายเหตุ: AuthResult ใช้ field `error: AuthAlert` ไม่ใช่ `message` จึงคงนิยามแยกไว้
 */
export type Result<TSuccess extends object = object> =
  | ({ ok: true } & TSuccess)
  | { ok: false; message: string };
