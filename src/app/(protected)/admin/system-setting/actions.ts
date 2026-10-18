"use server";

import { revalidatePath } from "next/cache";

import * as servicePeriods from "@/lib/admin/service-periods";
import type { ServicePeriodInput, ServicePeriodResult } from "@/lib/admin/service-periods";
import { requireAdmin } from "@/lib/auth/guards";

/**
 * สถานะที่ useActionState ใช้แสดงข้อความ inline
 * null = ยังไม่มีการส่ง, { ok: true } = สำเร็จ, { ok: false } = ผิดพลาด
 */
export type ServicePeriodActionState = ServicePeriodResult | null;

const INVALID_KIND_MESSAGE = "ประเภทช่วงเวลาต้องเป็น NORMAL หรือ EXAM";
const MISSING_ID_MESSAGE = "ไม่พบรายการที่ต้องการ กรุณารีเฟรชหน้าแล้วลองใหม่";
const PATH = "/admin/system-setting";

function readId(formData: FormData): string {
  return String(formData.get("id") ?? "").trim();
}

/** แปลงค่าดิบจากฟอร์มเป็นอินพุตช่วงเวลา — คืนข้อความไทยเมื่อ kind ไม่ถูกต้อง */
function readInput(formData: FormData): ServicePeriodInput | string {
  const kind = formData.get("kind");

  if (!servicePeriods.isServicePeriodKind(kind)) {
    return INVALID_KIND_MESSAGE;
  }

  const effectiveTo = String(formData.get("effectiveTo") ?? "").trim();

  return {
    name: String(formData.get("name") ?? "").trim(),
    kind,
    openTime: String(formData.get("openTime") ?? "").trim(),
    closeTime: String(formData.get("closeTime") ?? "").trim(),
    effectiveFrom: String(formData.get("effectiveFrom") ?? "").trim(),
    // ว่าง = เปิดต่อไปเรื่อย ๆ
    effectiveTo: effectiveTo ? effectiveTo : null,
  };
}

/** เพิ่มช่วงเวลาให้บริการ */
export async function createServicePeriod(
  _prevState: ServicePeriodActionState,
  formData: FormData,
): Promise<ServicePeriodResult> {
  const admin = await requireAdmin();

  const input = readInput(formData);

  if (typeof input === "string") {
    return { ok: false, message: input };
  }

  const result = await servicePeriods.createServicePeriod(input, admin.id);

  if (result.ok) {
    revalidatePath(PATH);
  }

  return result;
}

/** แก้ไขช่วงเวลาให้บริการ */
export async function updateServicePeriod(
  _prevState: ServicePeriodActionState,
  formData: FormData,
): Promise<ServicePeriodResult> {
  await requireAdmin();

  const id = readId(formData);

  if (!id) {
    return { ok: false, message: MISSING_ID_MESSAGE };
  }

  const input = readInput(formData);

  if (typeof input === "string") {
    return { ok: false, message: input };
  }

  const result = await servicePeriods.updateServicePeriod(id, input);

  if (result.ok) {
    revalidatePath(PATH);
  }

  return result;
}

/** ลบช่วงเวลาให้บริการ (hard delete) */
export async function deleteServicePeriod(
  _prevState: ServicePeriodActionState,
  formData: FormData,
): Promise<ServicePeriodResult> {
  await requireAdmin();

  const id = readId(formData);

  if (!id) {
    return { ok: false, message: MISSING_ID_MESSAGE };
  }

  const result = await servicePeriods.deleteServicePeriod(id);

  if (result.ok) {
    revalidatePath(PATH);
  }

  return result;
}
