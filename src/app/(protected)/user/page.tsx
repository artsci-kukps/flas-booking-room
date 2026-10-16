import { redirect } from "next/navigation";

/**
 * หน้าหลักของผู้ใช้เป็นเพียงทางผ่าน — ทุกเส้นทางขึ้นต้นด้วย /user/...
 * และ /user จะพาไปหน้าจองห้องซึ่งเป็นค่าเริ่มต้นของพื้นที่ผู้ใช้
 */
export default function UserHome() {
  redirect("/user/booking");
}
