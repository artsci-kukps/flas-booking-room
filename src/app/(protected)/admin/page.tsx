import { redirect } from "next/navigation";

/**
 * หน้าหลักของแอดมินเป็นเพียงทางผ่าน — ทุกเส้นทางขึ้นต้นด้วย /admin/...
 * และ /admin จะพาไปหน้าแดชบอร์ดซึ่งเป็นค่าเริ่มต้นของพื้นที่แอดมิน
 */
export default function AdminHome() {
  redirect("/admin/dashboard");
}
