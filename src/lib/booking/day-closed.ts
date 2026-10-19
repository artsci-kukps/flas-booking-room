import { formatThaiDate } from "@/lib/format";

import type { DayAvailability } from "./day-availability";

/**
 * ข้อความอธิบายวันปิดทำการ — ตรรกะแสดงผลล้วน ใช้ร่วมกันได้ทุกจอ
 * popup จองห้อง (ticket #19) แสดงข้อความนี้แทนตารางช่องว่างเมื่อวันที่เลือกปิด
 */

type ClosedDay = Extract<DayAvailability, { open: false }>;

/**
 * ข้อความแจ้งเหตุผลที่วันนั้นปิดรับจอง (TOR ข้อ 5.1–5.2)
 * - เสาร์–อาทิตย์: วันที่แบบไทย + ชื่อวัน (นับจากสตริง YYYY-MM-DD ตรง ๆ ไม่พึ่ง timezone)
 * - วันหยุด: ชื่อวันหยุดกำกับเมื่อมี
 * - ไม่มีช่วงเวลาให้บริการ: แจ้งว่ายังไม่มีเวลาให้เลือก
 */
export function dayClosedMessage(data: ClosedDay): string {
  const dateTh = formatThaiDate(data.date);

  if (data.reason === "weekend") {
    const dow = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
      timeZone: "Asia/Bangkok",
      weekday: "long",
    }).format(new Date(`${data.date}T12:00:00Z`));

    return `ปิดทำการในวันที่ ${dateTh} (${dow})`;
  }

  if (data.reason === "holiday") {
    return data.holidayName ? `ปิดทำการ — ${data.holidayName}` : "ปิดทำการ (วันหยุดนักขัตฤกษ์)";
  }

  if (data.reason === "no-service-period") {
    return "ยังไม่มีช่วงเวลาให้บริการสำหรับวันที่เลือก";
  }

  return `ปิดทำการในวันที่ ${dateTh}`;
}
