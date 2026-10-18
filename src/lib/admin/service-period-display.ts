import { formatThaiDate } from "@/lib/format";
import type { ServicePeriodKind } from "@/db/schema";

import type { ServicePeriodRow } from "./service-periods";

/**
 * ตัวช่วยแสดงผลของช่วงเวลาให้บริการ — ป้ายชนิดและรูปแบบวันเวลาสำหรับหน้าจอจัดการ
 */

/** ป้ายกำกับ kind สำหรับแสดงในตาราง/ฟอร์ม */
export const SERVICE_PERIOD_KIND_LABEL: Record<ServicePeriodKind, string> = {
  NORMAL: "วันปกติ",
  EXAM: "ช่วงสอบ",
};

/** '08:30–16:30' — ตัดวินาทีทิ้งถ้า PG คืน HH:MM:SS */
export function formatServiceTimeRange(
  row: Pick<ServicePeriodRow, "openTime" | "closeTime">,
): string {
  const short = (time: string) => time.slice(0, 5);
  return `${short(row.openTime)}–${short(row.closeTime)}`;
}

/** ช่วงวันที่มีผล — '1 ม.ค. 2569 – ไม่กำหนดสิ้นสุด' หรือ '1 พ.ค. 2569 – 31 พ.ค. 2569' */
export function formatEffectiveRange(
  row: Pick<ServicePeriodRow, "effectiveFrom" | "effectiveTo">,
): string {
  const from = formatThaiDate(row.effectiveFrom);

  if (row.effectiveTo === null) {
    return `${from} – ไม่กำหนดสิ้นสุด`;
  }

  return `${from} – ${formatThaiDate(row.effectiveTo)}`;
}

/** ตรวจว่าช่วงเวลานี้มีผลในวันที่กำหนด ('YYYY-MM-DD') */
export function isEffectiveOn(row: ServicePeriodRow, date: string): boolean {
  return row.effectiveFrom <= date && (row.effectiveTo === null || row.effectiveTo >= date);
}
