import { and, asc, desc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";

import db from "@/db";
import { roomType } from "@/db/schema";

import type { Result } from "@/lib/result";

import { pgErrorCode } from "./pg-error";

/**
 * ชั้นข้อมูล/โดเมนของการจัดการประเภทห้อง (ไม่ใช่ "use server")
 * แยกตรรกะการตรวจค่า (บริสุทธิ์ ทดสอบได้โดยไม่ต้องมี DB) ออกจากที่แตะฐานข้อมูล
 */

export const BOOKING_MODES = ["CAPACITY", "EXCLUSIVE"] as const;
export type BookingMode = (typeof BOOKING_MODES)[number];

/** ตรวจว่าเป็นโหมดการจองที่รู้จักหรือไม่ — ใช้กับค่าดิบจากฟอร์ม */
export function isBookingMode(value: unknown): value is BookingMode {
  return value === "CAPACITY" || value === "EXCLUSIVE";
}

/** แถวประเภทห้องแบบแคบเท่าที่หน้าจัดการต้องใช้ */
export type RoomTypeRow = {
  id: string;
  code: string;
  typeName: string;
  bookingMode: BookingMode;
  minDurationMinutes: number;
  createdAt: Date;
};

/** แถวที่ถูกลบ — เพิ่มข้อมูลผู้ลบ/เวลาลบสำหรับแผงกู้คืน */
export type DeletedRoomTypeRow = RoomTypeRow & {
  deletedAt: Date;
  deletedBy: string | null;
};

/** แถวดิบที่มีคอลัมน์ deleted_at (อาจเป็น null) — ใช้ภายในตอนค้นหา/ตัดสินกู้คืน */
export type RoomTypeWithDeletedRow = RoomTypeRow & {
  deletedAt: Date | null;
  deletedBy: string | null;
};

export type RoomTypeInput = {
  code: string;
  typeName: string;
  bookingMode: BookingMode;
  minDurationMinutes: number;
};

/** ผลของการแก้ไขประเภทห้อง — คืนรูปเดียวกันให้ UI แสดงข้อความ inline ได้ */
export type RoomTypeResult = Result<{ restored?: boolean }>;

const CODE_MESSAGE = "รหัสประเภทห้องต้องเป็นตัวอักษร 1 ตัว เช่น S, G, P";
const NAME_REQUIRED_MESSAGE = "กรุณากรอกชื่อประเภทห้อง";
const NAME_TOO_LONG_MESSAGE = "ชื่อประเภทห้องยาวเกิน 100 ตัวอักษร";
const DURATION_MESSAGE = "ระยะเวลาขั้นต่ำต้องเป็นจำนวนนาทีเต็มที่มากกว่า 0";
const CODE_DUPLICATE_MESSAGE = "รหัสประเภทห้องนี้ถูกใช้งานอยู่แล้ว";
const NAME_DUPLICATE_MESSAGE = "ชื่อประเภทห้องนี้ถูกใช้งานอยู่แล้ว";
const RESTORE_AMBIGUOUS_MESSAGE =
  "พบรายการเดิมที่รหัสกับชื่อตรงกับคนละแถว กรุณาตรวจสอบรายการที่ถูกลบก่อนลองใหม่";
const NOT_FOUND_MESSAGE = "ไม่พบประเภทห้องที่ต้องการแก้ไข กรุณารีเฟรชหน้าแล้วลองใหม่";
const GUARD_MESSAGE =
  "ลบไม่ได้เพราะยังมีห้องที่ใช้งานอยู่ภายใต้ประเภทนี้ กรุณาย้ายหรือลบห้องเหล่านั้นก่อน";
const UNIQUE_MESSAGE = "รหัสหรือชื่อประเภทห้องซ้ำกับรายการที่ใช้งานอยู่ กรุณารีเฟรชหน้าแล้วลองใหม่";

/**
 * ตรวจค่าอินพุตของประเภทห้องแบบบริสุทธิ์
 * คืนข้อความภาษาไทยเมื่อไม่ผ่าน มิฉะนั้นคืน null
 */
export function validateRoomTypeInput(input: RoomTypeInput): string | null {
  if (input.code.trim().length !== 1) {
    return CODE_MESSAGE;
  }

  const typeName = input.typeName.trim();

  if (!typeName) {
    return NAME_REQUIRED_MESSAGE;
  }

  if (typeName.length > 100) {
    return NAME_TOO_LONG_MESSAGE;
  }

  if (!Number.isInteger(input.minDurationMinutes) || input.minDurationMinutes <= 0) {
    return DURATION_MESSAGE;
  }

  return null;
}

const ROOM_TYPE_COLUMNS = {
  id: roomType.id,
  code: roomType.code,
  typeName: roomType.typeName,
  bookingMode: roomType.bookingMode,
  minDurationMinutes: roomType.minDurationMinutes,
  createdAt: roomType.createdAt,
};

const DELETED_ROOM_TYPE_COLUMNS = {
  ...ROOM_TYPE_COLUMNS,
  deletedAt: roomType.deletedAt,
  deletedBy: roomType.deletedBy,
};

type RoomTypeTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * คีย์ advisory ระดับ transaction สำหรับ serialize การแก้ไขประเภทห้อง
 * ให้ create/update/delete/restore เข้าคิวทีละราย กันการแข่งกันอ่าน-แล้ว-เขียน
 */
const ROOM_TYPE_LOCK_KEY = 48_202_004;

/** รายชื่อประเภทห้องที่ยังใช้งานอยู่ เรียงตามรหัส */
export async function listRoomTypes(): Promise<RoomTypeRow[]> {
  return db
    .select(ROOM_TYPE_COLUMNS)
    .from(roomType)
    .where(isNull(roomType.deletedAt))
    .orderBy(asc(roomType.code));
}

/** รายชื่อประเภทห้องที่ถูกลบ เรียงจากลบล่าสุด */
export async function listDeletedRoomTypes(): Promise<DeletedRoomTypeRow[]> {
  const rows = await db
    .select(DELETED_ROOM_TYPE_COLUMNS)
    .from(roomType)
    .where(isNotNull(roomType.deletedAt))
    .orderBy(desc(roomType.deletedAt));

  return rows.filter((row): row is DeletedRoomTypeRow => row.deletedAt !== null);
}

/** หาแถวที่รหัสหรือชื่อตรงกับคีย์ค้น (รวมรายการที่ถูกลบ) — ใช้ตัดสินกู้คืนหรือเพิ่มใหม่ */
async function findCandidates(
  executor: Pick<RoomTypeTransaction, "select">,
  code: string,
  typeName: string,
): Promise<RoomTypeWithDeletedRow[]> {
  return executor
    .select(DELETED_ROOM_TYPE_COLUMNS)
    .from(roomType)
    .where(or(eq(roomType.code, code), eq(roomType.typeName, typeName)));
}

/** รหัส/ชื่อที่ยังใช้งานอยู่ (นอกจาก id ที่กำหนด) — ใช้ตรวจการชนตอนแก้ไข/กู้คืน */
async function findActiveConflicts(
  executor: Pick<RoomTypeTransaction, "select">,
  excludeId: string,
  code: string,
  typeName: string,
): Promise<RoomTypeWithDeletedRow[]> {
  const rows = await executor
    .select(DELETED_ROOM_TYPE_COLUMNS)
    .from(roomType)
    .where(
      and(
        isNull(roomType.deletedAt),
        or(eq(roomType.code, code), eq(roomType.typeName, typeName)),
      ),
    );

  return rows.filter((row) => row.id !== excludeId);
}

/** แปลงข้อผิดพลาด unique violation เป็นข้อความไทย */
function mapUniqueViolation(error: unknown): RoomTypeResult | null {
  return pgErrorCode(error) === "23505" ? { ok: false, message: UNIQUE_MESSAGE } : null;
}

/**
 * เพิ่มประเภทห้อง — ถ้ารหัส/ชื่อตรงกับแถวที่ถูกลบอยู่ ให้กู้คืนแถวเดิม (รักษา FK ประวัติ)
 * ทำแบบ "ค้นหาก่อนแล้วตัดสิน" ภายในทรานแซกชัน เพราะ unique index เป็น partial
 * (จับเฉพาะรายการที่ยังไม่ถูกลบ) การพึ่ง unique violation จึงไม่พอ
 */
export async function createRoomType(input: RoomTypeInput): Promise<RoomTypeResult> {
  const invalid = validateRoomTypeInput(input);

  if (invalid) {
    return { ok: false, message: invalid };
  }

  const code = input.code.trim();
  const typeName = input.typeName.trim();

  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${ROOM_TYPE_LOCK_KEY})`);

      const candidates = await findCandidates(tx, code, typeName);
      const byCode = candidates.find((row) => row.code === code);

      if (byCode && byCode.deletedAt === null) {
        return { ok: false, message: CODE_DUPLICATE_MESSAGE };
      }

      const byName = candidates.find((row) => row.typeName === typeName);

      if (byCode) {
        if (byName && byName.id !== byCode.id) {
          return {
            ok: false,
            message:
              byName.deletedAt === null ? NAME_DUPLICATE_MESSAGE : RESTORE_AMBIGUOUS_MESSAGE,
          };
        }

        await tx
          .update(roomType)
          .set({
            code,
            typeName,
            bookingMode: input.bookingMode,
            minDurationMinutes: input.minDurationMinutes,
            deletedAt: null,
            deletedBy: null,
          })
          .where(eq(roomType.id, byCode.id));

        return { ok: true, restored: true };
      }

      if (byName) {
        if (byName.deletedAt === null) {
          return { ok: false, message: NAME_DUPLICATE_MESSAGE };
        }

        await tx
          .update(roomType)
          .set({
            code,
            typeName,
            bookingMode: input.bookingMode,
            minDurationMinutes: input.minDurationMinutes,
            deletedAt: null,
            deletedBy: null,
          })
          .where(eq(roomType.id, byName.id));

        return { ok: true, restored: true };
      }

      await tx.insert(roomType).values({
        code,
        typeName,
        bookingMode: input.bookingMode,
        minDurationMinutes: input.minDurationMinutes,
      });

      return { ok: true, restored: false };
    });
  } catch (error) {
    const mapped = mapUniqueViolation(error);

    if (mapped) {
      return mapped;
    }

    throw error;
  }
}

/** แก้ไขประเภทห้องที่ยังใช้งานอยู่ */
export async function updateRoomType(
  id: string,
  input: RoomTypeInput,
): Promise<RoomTypeResult> {
  const invalid = validateRoomTypeInput(input);

  if (invalid) {
    return { ok: false, message: invalid };
  }

  const code = input.code.trim();
  const typeName = input.typeName.trim();

  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${ROOM_TYPE_LOCK_KEY})`);

      const rows = await tx
        .select(DELETED_ROOM_TYPE_COLUMNS)
        .from(roomType)
        .where(eq(roomType.id, id));
      const existing = rows.find((row) => row.id === id);

      if (!existing || existing.deletedAt) {
        return { ok: false, message: NOT_FOUND_MESSAGE };
      }

      const conflicts = await findActiveConflicts(tx, id, code, typeName);

      if (conflicts.some((row) => row.code === code)) {
        return { ok: false, message: CODE_DUPLICATE_MESSAGE };
      }

      if (conflicts.some((row) => row.typeName === typeName)) {
        return { ok: false, message: NAME_DUPLICATE_MESSAGE };
      }

      await tx
        .update(roomType)
        .set({
          code,
          typeName,
          bookingMode: input.bookingMode,
          minDurationMinutes: input.minDurationMinutes,
        })
        .where(eq(roomType.id, id));

      return { ok: true };
    });
  } catch (error) {
    const mapped = mapUniqueViolation(error);

    if (mapped) {
      return mapped;
    }

    throw error;
  }
}

/**
 * ลบประเภทห้องแบบ soft delete — บันทึกผู้ลบ
 * trigger `room_type_guard_delete` ที่ระดับ DB จะโยน restrict_violation (23001)
 * เมื่อยังมีห้องที่ใช้งานอยู่ภายใต้ประเภทนี้
 */
export async function softDeleteRoomType(
  id: string,
  actorId: string,
): Promise<RoomTypeResult> {
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${ROOM_TYPE_LOCK_KEY})`);

      const rows = await tx
        .select(DELETED_ROOM_TYPE_COLUMNS)
        .from(roomType)
        .where(eq(roomType.id, id));
      const existing = rows.find((row) => row.id === id);

      if (!existing || existing.deletedAt) {
        return { ok: false, message: NOT_FOUND_MESSAGE };
      }

      await tx
        .update(roomType)
        .set({ deletedAt: new Date(), deletedBy: actorId })
        .where(eq(roomType.id, id));

      return { ok: true };
    });
  } catch (error) {
    if (pgErrorCode(error) === "23001") {
      return { ok: false, message: GUARD_MESSAGE };
    }

    throw error;
  }
}

/** กู้คืนประเภทห้องที่ถูกลบ — ล้าง deleted_at/deleted_by (ไม่เก็บผู้กู้คืนตามสคีมา) */
export async function restoreRoomType(id: string): Promise<RoomTypeResult> {
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${ROOM_TYPE_LOCK_KEY})`);

      const rows = await tx
        .select(DELETED_ROOM_TYPE_COLUMNS)
        .from(roomType)
        .where(eq(roomType.id, id));
      const existing = rows.find((row) => row.id === id);

      if (!existing) {
        return { ok: false, message: NOT_FOUND_MESSAGE };
      }

      if (!existing.deletedAt) {
        return { ok: true };
      }

      const conflicts = await findActiveConflicts(tx, id, existing.code, existing.typeName);

      if (conflicts.some((row) => row.code === existing.code)) {
        return { ok: false, message: CODE_DUPLICATE_MESSAGE };
      }

      if (conflicts.some((row) => row.typeName === existing.typeName)) {
        return { ok: false, message: NAME_DUPLICATE_MESSAGE };
      }

      await tx
        .update(roomType)
        .set({ deletedAt: null, deletedBy: null })
        .where(eq(roomType.id, id));

      return { ok: true, restored: true };
    });
  } catch (error) {
    const mapped = mapUniqueViolation(error);

    if (mapped) {
      return mapped;
    }

    throw error;
  }
}
