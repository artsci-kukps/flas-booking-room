import { asc, desc, eq } from "drizzle-orm";

import db from "@/db";
import {
  servicePeriod,
  servicePeriodKindValues,
  users,
  type ServicePeriodKind,
} from "@/db/schema";

import { pgErrorCode } from "./pg-error";

export type { ServicePeriodKind } from "@/db/schema";

/**
 * ชั้นข้อมูล/โดเมนของการจัดการช่วงเวลาให้บริการ (ไม่ใช่ "use server")
 * ตาม TOR ข้อ 5 และ A.6: NORMAL ห้ามทับ NORMAL, EXAM ห้ามทับ EXAM (ที่ DB)
 * แต่ EXAM ทับ NORMAL ได้ — บังคับด้วย exclusion constraint `service_period_no_overlap`
 */

/** แถวช่วงเวลาให้บริการ — คอลัมน์ที่หน้าจอจัดการต้องใช้ */
export type ServicePeriodRow = {
  id: string;
  name: string;
  kind: ServicePeriodKind;
  openTime: string;
  closeTime: string;
  /** 'YYYY-MM-DD' */
  effectiveFrom: string;
  /** 'YYYY-MM-DD' | null — null = เปิดต่อไปเรื่อย ๆ */
  effectiveTo: string | null;
  createdAt: Date;
};

export type ServicePeriodInput = {
  name: string;
  kind: ServicePeriodKind;
  openTime: string;
  closeTime: string;
  effectiveFrom: string;
  effectiveTo: string | null;
};

/** ผลของการแก้ไขช่วงเวลา — คืนรูปเดียวกันให้ UI แสดงข้อความ inline ได้ */
export type ServicePeriodResult = { ok: true } | { ok: false; message: string };

/** ตรวจว่าเป็น kind ที่รู้จักหรือไม่ — ใช้กับค่าดิบจากฟอร์ม */
export function isServicePeriodKind(value: unknown): value is ServicePeriodKind {
  return typeof value === "string" && (servicePeriodKindValues as readonly string[]).includes(value);
}

const NAME_REQUIRED_MESSAGE = "กรุณากรอกชื่อช่วงเวลา";
const NAME_TOO_LONG_MESSAGE = "ชื่อช่วงเวลายาวเกิน 100 ตัวอักษร";
const KIND_MESSAGE = "ประเภทช่วงเวลาต้องเป็น NORMAL หรือ EXAM";
const TIME_MESSAGE = "เวลาเปิด–ปิดต้องอยู่ในรูปแบบ HH:MM และเวลาปิดต้องมากกว่าเวลาเปิด";
const DATE_MESSAGE = "วันที่มีผลต้องอยู่ในรูปแบบ YYYY-MM-DD";
const RANGE_MESSAGE = "วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มมีผล";
const OVERLAP_MESSAGE =
  "ช่วงเวลานี้ทับซ้อนกับช่วงเวลาประเภทเดียวกันที่มีอยู่แล้ว (NORMAL ชนกับ NORMAL, EXAM ชนกับ EXAM) กรุณาปรับวันที่มีผล";
const INVALID_MESSAGE = "ข้อมูลช่วงเวลาไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่";
const NOT_FOUND_MESSAGE = "ไม่พบช่วงเวลาที่ต้องการ กรุณารีเฟรชหน้าแล้วลองใหม่";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * ตรวจค่าอินพุตของช่วงเวลาแบบบริสุทธิ์ (ไม่แตะฐานข้อมูล)
 * คืนข้อความภาษาไทยเมื่อไม่ผ่าน มิฉะนั้นคืน null
 * หมายเหตุ: การทับซ้อนระหว่างแถวถ้าชนกันเองให้ DB (exclusion constraint) เป็นด่านสุดท้าย
 */
export function validateServicePeriodInput(input: ServicePeriodInput): string | null {
  if (!isServicePeriodKind(input.kind)) {
    return KIND_MESSAGE;
  }

  const name = input.name.trim();

  if (!name) {
    return NAME_REQUIRED_MESSAGE;
  }

  if (name.length > 100) {
    return NAME_TOO_LONG_MESSAGE;
  }

  if (!TIME_PATTERN.test(input.openTime) || !TIME_PATTERN.test(input.closeTime)) {
    return TIME_MESSAGE;
  }

  // 'HH:MM' และ 'HH:MM:SS' เปรียบเทียบเชิงพจน์ได้ถูกต้อง เพราะเป็น zero-padded
  if (input.closeTime <= input.openTime) {
    return TIME_MESSAGE;
  }

  if (!DATE_PATTERN.test(input.effectiveFrom)) {
    return DATE_MESSAGE;
  }

  if (input.effectiveTo !== null) {
    if (!DATE_PATTERN.test(input.effectiveTo)) {
      return DATE_MESSAGE;
    }

    if (input.effectiveTo < input.effectiveFrom) {
      return RANGE_MESSAGE;
    }
  }

  return null;
}

const SERVICE_PERIOD_COLUMNS = {
  id: servicePeriod.id,
  name: servicePeriod.name,
  kind: servicePeriod.kind,
  openTime: servicePeriod.openTime,
  closeTime: servicePeriod.closeTime,
  effectiveFrom: servicePeriod.effectiveFrom,
  effectiveTo: servicePeriod.effectiveTo,
  createdAt: servicePeriod.createdAt,
};

/** รายชื่อช่วงเวลาให้บริการ เรียงจากมีผลวันแรกมาก → ใหม่สร้างก่อน (วันเริ่มเท่ากัน) */
export async function listServicePeriods(): Promise<ServicePeriodRow[]> {
  return db
    .select(SERVICE_PERIOD_COLUMNS)
    .from(servicePeriod)
    .orderBy(asc(servicePeriod.effectiveFrom), desc(servicePeriod.createdAt));
}

/** แปลงข้อผิดพลาดจาก DB เป็นข้อความไทย — exclusion (23P01) / check (23514) */
function mapDbViolation(error: unknown): ServicePeriodResult | null {
  const code = pgErrorCode(error);

  if (code === "23P01") {
    return { ok: false, message: OVERLAP_MESSAGE };
  }

  if (code === "23514") {
    return { ok: false, message: INVALID_MESSAGE };
  }

  return null;
}

/** เพิ่มช่วงเวลาให้บริการ — created_by คือแอดมินผู้ดำเนินการ */
export async function createServicePeriod(
  input: ServicePeriodInput,
  actorId: string,
): Promise<ServicePeriodResult> {
  const invalid = validateServicePeriodInput(input);

  if (invalid) {
    return { ok: false, message: invalid };
  }

  try {
    await db.insert(servicePeriod).values({
      name: input.name.trim(),
      kind: input.kind,
      openTime: input.openTime,
      closeTime: input.closeTime,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      createdBy: actorId,
    });

    return { ok: true };
  } catch (error) {
    const mapped = mapDbViolation(error);

    if (mapped) {
      return mapped;
    }

    throw error;
  }
}

/** แก้ไขช่วงเวลาให้บริการ (hard edit — ไม่มี soft delete) */
export async function updateServicePeriod(
  id: string,
  input: ServicePeriodInput,
): Promise<ServicePeriodResult> {
  const invalid = validateServicePeriodInput(input);

  if (invalid) {
    return { ok: false, message: invalid };
  }

  try {
    return await db.transaction(async (tx) => {
      const rows = await tx
        .select({ id: servicePeriod.id })
        .from(servicePeriod)
        .where(eq(servicePeriod.id, id));

      if (!rows.some((row) => row.id === id)) {
        return { ok: false, message: NOT_FOUND_MESSAGE };
      }

      await tx
        .update(servicePeriod)
        .set({
          name: input.name.trim(),
          kind: input.kind,
          openTime: input.openTime,
          closeTime: input.closeTime,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: input.effectiveTo,
        })
        .where(eq(servicePeriod.id, id));

      return { ok: true };
    });
  } catch (error) {
    const mapped = mapDbViolation(error);

    if (mapped) {
      return mapped;
    }

    throw error;
  }
}

/** ลบช่วงเวลาให้บริการแบบ hard delete (ข้อมูลเชิงเวลา ไม่ถูกอ้างอิงจากประวัติการจอง) */
export async function deleteServicePeriod(id: string): Promise<ServicePeriodResult> {
  const result = await db.delete(servicePeriod).where(eq(servicePeriod.id, id));

  if ((result.rowCount ?? 0) === 0) {
    return { ok: false, message: NOT_FOUND_MESSAGE };
  }

  return { ok: true };
}

/**
 * เลือกช่วงเวลาที่มีผลสำหรับวันที่กำหนด
 * - กรองเฉพาะแถวที่ effective_from <= วันนั้น <= effective_to (ว่าง = ต่อเนื่อง)
 * - ถ้ามีทั้ง NORMAL และ EXAM ใช้ EXAM (ช่วงสอบทับช่วงปกติ)
 * - ถ้ามีหลายแถวของชนิดเดียวกัน (ป้องกันไว้ก่อน แม้ DB กันไว้แล้ว)
 *   ใช้แถวที่สร้างล่าสุด ตามข้อกำหนดของตั๋ว
 */
export function resolveServicePeriodForDate(
  rows: readonly ServicePeriodRow[],
  date: string,
): ServicePeriodRow | null {
  const effective = rows.filter(
    (row) => row.effectiveFrom <= date && (row.effectiveTo === null || row.effectiveTo >= date),
  );

  if (effective.length === 0) {
    return null;
  }

  const pick = (kind: ServicePeriodKind): ServicePeriodRow | undefined => {
    const sameKind = effective.filter((row) => row.kind === kind);

    // สร้างล่าสุดชนะ; id เป็นตัวตัดสินเมื่อ createdAt ตรงกัน กันผลสุ่ม
    return sameKind.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id),
    )[0];
  };

  return pick("EXAM") ?? pick("NORMAL") ?? null;
}

/** ช่วง NORMAL เริ่มต้นของระบบ — 08:30–16:30 ตาม TOR ภาคผนวก B ข้อ 1 */
export const DEFAULT_SERVICE_PERIOD = {
  name: "เวลาทำการปกติ",
  kind: "NORMAL",
  openTime: "08:30",
  closeTime: "16:30",
} as const;

/** วันปัจจุบันในเขตเวลา Asia/Bangkok ในรูป YYYY-MM-DD (ไม่พึ่ง timezone ของ server) */
export function todayInBangkok(now: Date = new Date()): string {
  return now.toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
}

/**
 * Seed ค่า NORMAL เริ่มต้น 08:30–16:30 — ใช้หลังตั้งแอดมินคนแรก (scripts/seed-admin.ts)
 * - คืน 'no-admin' เมื่อไม่พบผู้ใช้อีเมลนี้ (ยังไม่ได้ตั้งแอดมิน)
 * - คืน 'skipped' เมื่อมีช่วง NORMAL อยู่แล้ว (เรียกซ้ำได้ ไม่สร้างซ้ำ)
 * - คืน 'created' เมื่อเพิ่มช่วง NORMAL แรกสำเร็จ (มีผลตั้งแต่วันรันสคริปต์)
 */
export async function ensureDefaultServicePeriod(
  adminEmail: string,
  today: string = todayInBangkok(),
): Promise<"created" | "skipped" | "no-admin"> {
  const admins = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, adminEmail));

  const admin = admins.find((row) => row.id);

  if (!admin) {
    return "no-admin";
  }

  const existing = await db
    .select({ id: servicePeriod.id })
    .from(servicePeriod)
    .where(eq(servicePeriod.kind, "NORMAL"));

  if (existing.length > 0) {
    return "skipped";
  }

  const result = await createServicePeriod(
    { ...DEFAULT_SERVICE_PERIOD, effectiveFrom: today, effectiveTo: null },
    admin.id,
  );

  if (!result.ok) {
    throw new Error(result.message);
  }

  return "created";
}
