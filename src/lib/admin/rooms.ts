import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import db from "@/db";
import { roomType, rooms } from "@/db/schema";

import type { BookingMode } from "./room-types";
import { pgErrorCode } from "./pg-error";

/**
 * ชั้นข้อมูล/โดเมนของการจัดการห้อง (ไม่ใช่ "use server")
 * เก็บกติกาที่ทดสอบได้แบบบริสุทธิ์ (validateRoomBasics/validateRoomInput) แยกจากที่แตะฐานข้อมูล
 */

/** แถวห้องแบบแคบเท่าที่หน้าจัดการต้องใช้ พร้อมข้อมูลประเภทห้องสำหรับแสดงผล */
export type AdminRoomRow = {
  id: string;
  name: string;
  roomTypeId: string;
  roomTypeCode: string;
  roomTypeName: string;
  bookingMode: BookingMode;
  maxCapacity: number | null;
  facilities: string | null;
  createdAt: Date;
};

export type DeletedRoomRow = AdminRoomRow & {
  deletedAt: Date;
  deletedBy: string | null;
};

/** แถวดิบที่มีคอลัมน์ deleted_at (อาจเป็น null) — ใช้ภายในตอนค้นหา/ตัดสินกู้คืน */
export type RoomWithDeletedRow = AdminRoomRow & {
  deletedAt: Date | null;
  deletedBy: string | null;
};

export type RoomInput = {
  name: string;
  roomTypeId: string;
  maxCapacity: number | null;
  facilities: string | null;
};

/** ผลของการแก้ไขห้อง — คืนรูปเดียวกันให้ UI แสดงข้อความ inline ได้ */
export type RoomResult = { ok: true; restored?: boolean } | { ok: false; message: string };

const NAME_REQUIRED_MESSAGE = "กรุณากรอกชื่อห้อง";
const NAME_TOO_LONG_MESSAGE = "ชื่อห้องยาวเกิน 100 ตัวอักษร";
const ROOM_TYPE_REQUIRED_MESSAGE = "กรุณาเลือกประเภทห้อง";
const CAPACITY_INVALID_MESSAGE = "ความจุต้องเป็นจำนวนเต็มมากกว่า 0";
const CAPACITY_REQUIRED_MESSAGE = "ห้องประเภทจองตามความจุ (CAPACITY) ต้องระบุความจุมากกว่า 0";
const ROOM_TYPE_NOT_FOUND_MESSAGE =
  "ไม่พบประเภทห้องที่เลือก อาจถูกลบไปแล้ว กรุณารีเฟรชหน้าแล้วลองใหม่";
const ROOM_TYPE_DELETED_RESTORE_MESSAGE =
  "กู้คืนไม่ได้เพราะประเภทห้องของห้องนี้ถูกลบไปแล้ว กรุณากู้คืนประเภทห้องก่อน";
const NAME_DUPLICATE_MESSAGE = "ชื่อห้องนี้ถูกใช้งานอยู่แล้ว";
const NOT_FOUND_MESSAGE = "ไม่พบห้องที่ต้องการแก้ไข กรุณารีเฟรชหน้าแล้วลองใหม่";
const UNIQUE_MESSAGE = "ชื่อห้องซ้ำกับรายการที่ใช้งานอยู่ กรุณารีเฟรชหน้าแล้วลองใหม่";

/** ตรวจกติกาของห้องที่ไม่ขึ้นกับโหมดการจอง — บริสุทธิ์ ทดสอบได้โดยไม่ต้องมี DB */
export function validateRoomBasics(input: RoomInput): string | null {
  const name = input.name.trim();

  if (!name) {
    return NAME_REQUIRED_MESSAGE;
  }

  if (name.length > 100) {
    return NAME_TOO_LONG_MESSAGE;
  }

  if (!input.roomTypeId.trim()) {
    return ROOM_TYPE_REQUIRED_MESSAGE;
  }

  if (input.maxCapacity !== null) {
    if (!Number.isInteger(input.maxCapacity) || input.maxCapacity <= 0) {
      return CAPACITY_INVALID_MESSAGE;
    }
  }

  return null;
}

/**
 * ตรวจอินพุตของห้องโดยคำนึงถึงโหมดการจองของประเภทที่เลือก
 * CAPACITY ต้องมีความจุ > 0, EXCLUSIVE ไม่บังคับ (ระบุได้แต่ต้อง > 0)
 */
export function validateRoomInput(input: RoomInput, bookingMode: BookingMode): string | null {
  const basic = validateRoomBasics(input);

  if (basic) {
    return basic;
  }

  if (bookingMode === "CAPACITY" && input.maxCapacity === null) {
    return CAPACITY_REQUIRED_MESSAGE;
  }

  return null;
}

const ROOM_COLUMNS = {
  id: rooms.id,
  name: rooms.name,
  roomTypeId: rooms.roomTypeId,
  roomTypeCode: roomType.code,
  roomTypeName: roomType.typeName,
  bookingMode: roomType.bookingMode,
  maxCapacity: rooms.maxCapacity,
  facilities: rooms.facilities,
  createdAt: rooms.createdAt,
};

const DELETED_ROOM_COLUMNS = {
  ...ROOM_COLUMNS,
  deletedAt: rooms.deletedAt,
  deletedBy: rooms.deletedBy,
};

type RoomTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type RoomExecutor = Pick<RoomTransaction, "select">;

/** คีย์ advisory ระดับ transaction สำหรับ serialize การแก้ไขห้อง */
const ROOM_LOCK_KEY = 48_202_005;

/** รายชื่อห้องที่ยังใช้งานอยู่ เรียงตามรหัสประเภทแล้วตามชื่อ */
export async function listRooms(): Promise<AdminRoomRow[]> {
  return db
    .select(ROOM_COLUMNS)
    .from(rooms)
    .innerJoin(roomType, eq(rooms.roomTypeId, roomType.id))
    .where(isNull(rooms.deletedAt))
    .orderBy(asc(roomType.code), asc(rooms.name));
}

/** รายชื่อห้องที่ถูกลบ เรียงจากลบล่าสุด */
export async function listDeletedRooms(): Promise<DeletedRoomRow[]> {
  const rows = await db
    .select(DELETED_ROOM_COLUMNS)
    .from(rooms)
    .innerJoin(roomType, eq(rooms.roomTypeId, roomType.id))
    .where(isNotNull(rooms.deletedAt))
    .orderBy(asc(rooms.name));

  return rows.filter((row): row is DeletedRoomRow => row.deletedAt !== null);
}

/** โหมดการจองของประเภทห้องที่เลือก (undefined ถ้าไม่พบหรือถูกลบ) */
async function findActiveBookingMode(
  executor: RoomExecutor,
  roomTypeId: string,
): Promise<BookingMode | undefined> {
  const rows = await executor
    .select({ bookingMode: roomType.bookingMode, deletedAt: roomType.deletedAt })
    .from(roomType)
    .where(eq(roomType.id, roomTypeId));
  const type = rows.find((row) => row.deletedAt === null);

  return type?.bookingMode;
}

/** แถวห้องที่ตรงชื่อ (รวมรายการที่ถูกลบ) — ใช้ตัดสินกู้คืนหรือเพิ่มใหม่ */
async function findNameCandidates(
  executor: RoomExecutor,
  name: string,
): Promise<{ id: string; name: string; deletedAt: Date | null }[]> {
  return executor
    .select({ id: rooms.id, name: rooms.name, deletedAt: rooms.deletedAt })
    .from(rooms)
    .where(eq(rooms.name, name));
}

/** แถวห้องตาม id (รวมรายการที่ถูกลบ) */
async function findRoomById(
  executor: RoomExecutor,
  id: string,
): Promise<{ id: string; name: string; roomTypeId: string; deletedAt: Date | null } | undefined> {
  const rows = await executor
    .select({
      id: rooms.id,
      name: rooms.name,
      roomTypeId: rooms.roomTypeId,
      deletedAt: rooms.deletedAt,
    })
    .from(rooms)
    .where(eq(rooms.id, id));

  return rows.find((row) => row.id === id);
}

/** ชื่อที่ยังใช้งานอยู่ของห้องอื่น (นอกจาก id ที่กำหนด) */
async function findActiveNameConflicts(
  executor: RoomExecutor,
  excludeId: string,
  name: string,
): Promise<{ id: string }[]> {
  const rows = await executor
    .select({ id: rooms.id })
    .from(rooms)
    .where(and(isNull(rooms.deletedAt), eq(rooms.name, name)));

  return rows.filter((row) => row.id !== excludeId);
}

/** แปลงค่าสิ่งอำนวยความสะดวกเป็นข้อความล้วน (ว่าง = null) */
function normalizeFacilities(facilities: string | null): string | null {
  const value = facilities?.trim();

  return value ? value : null;
}

/**
 * เพิ่มห้อง — ถ้าชื่อตรงกับแถวที่ถูกลบอยู่ ให้กู้คืนแถวเดิม (รักษา FK ประวัติ)
 * ค้นหาก่อนแล้วตัดสินในทรานแซกชันเดียว เพราะ unique index เป็น partial
 */
export async function createRoom(input: RoomInput): Promise<RoomResult> {
  const basic = validateRoomBasics(input);

  if (basic) {
    return { ok: false, message: basic };
  }

  const name = input.name.trim();
  const facilities = normalizeFacilities(input.facilities);

  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${ROOM_LOCK_KEY})`);

      const bookingMode = await findActiveBookingMode(tx, input.roomTypeId);

      if (!bookingMode) {
        return { ok: false, message: ROOM_TYPE_NOT_FOUND_MESSAGE };
      }

      const invalid = validateRoomInput(input, bookingMode);

      if (invalid) {
        return { ok: false, message: invalid };
      }

      const candidates = await findNameCandidates(tx, name);
      const existing = candidates.find((row) => row.name === name);

      if (existing && existing.deletedAt === null) {
        return { ok: false, message: NAME_DUPLICATE_MESSAGE };
      }

      if (existing) {
        await tx
          .update(rooms)
          .set({
            name,
            roomTypeId: input.roomTypeId,
            maxCapacity: input.maxCapacity,
            facilities,
            deletedAt: null,
            deletedBy: null,
          })
          .where(eq(rooms.id, existing.id));

        return { ok: true, restored: true };
      }

      await tx.insert(rooms).values({
        name,
        roomTypeId: input.roomTypeId,
        maxCapacity: input.maxCapacity,
        facilities,
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

/** แก้ไขห้องที่ยังใช้งานอยู่ */
export async function updateRoom(id: string, input: RoomInput): Promise<RoomResult> {
  const basic = validateRoomBasics(input);

  if (basic) {
    return { ok: false, message: basic };
  }

  const name = input.name.trim();
  const facilities = normalizeFacilities(input.facilities);

  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${ROOM_LOCK_KEY})`);

      const existing = await findRoomById(tx, id);

      if (!existing || existing.deletedAt) {
        return { ok: false, message: NOT_FOUND_MESSAGE };
      }

      const bookingMode = await findActiveBookingMode(tx, input.roomTypeId);

      if (!bookingMode) {
        return { ok: false, message: ROOM_TYPE_NOT_FOUND_MESSAGE };
      }

      const invalid = validateRoomInput(input, bookingMode);

      if (invalid) {
        return { ok: false, message: invalid };
      }

      const conflicts = await findActiveNameConflicts(tx, id, name);

      if (conflicts.length > 0) {
        return { ok: false, message: NAME_DUPLICATE_MESSAGE };
      }

      await tx
        .update(rooms)
        .set({
          name,
          roomTypeId: input.roomTypeId,
          maxCapacity: input.maxCapacity,
          facilities,
        })
        .where(eq(rooms.id, id));

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
 * ลบห้องแบบ soft delete — บันทึกผู้ลบ
 * ห้องที่ถูกลบจะไม่ปรากฏในรายการและไม่ถูกนำไปจอง (listRooms กรอง deleted_at)
 */
export async function softDeleteRoom(id: string, actorId: string): Promise<RoomResult> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${ROOM_LOCK_KEY})`);

    const existing = await findRoomById(tx, id);

    if (!existing || existing.deletedAt) {
      return { ok: false, message: NOT_FOUND_MESSAGE };
    }

    await tx
      .update(rooms)
      .set({ deletedAt: new Date(), deletedBy: actorId })
      .where(eq(rooms.id, id));

    return { ok: true };
  });
}

/** กู้คืนห้องที่ถูกลบ — ล้าง deleted_at/deleted_by (ไม่เก็บผู้กู้คืนตามสคีมา) */
export async function restoreRoom(id: string): Promise<RoomResult> {
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${ROOM_LOCK_KEY})`);

      const existing = await findRoomById(tx, id);

      if (!existing) {
        return { ok: false, message: NOT_FOUND_MESSAGE };
      }

      if (!existing.deletedAt) {
        return { ok: true };
      }

      const bookingMode = await findActiveBookingMode(tx, existing.roomTypeId);

      if (!bookingMode) {
        return { ok: false, message: ROOM_TYPE_DELETED_RESTORE_MESSAGE };
      }

      const conflicts = await findActiveNameConflicts(tx, id, existing.name);

      if (conflicts.length > 0) {
        return { ok: false, message: NAME_DUPLICATE_MESSAGE };
      }

      await tx
        .update(rooms)
        .set({ deletedAt: null, deletedBy: null })
        .where(eq(rooms.id, id));

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

/** แปลงข้อผิดพลาด unique violation เป็นข้อความไทย */
function mapUniqueViolation(error: unknown): RoomResult | null {
  return pgErrorCode(error) === "23505" ? { ok: false, message: UNIQUE_MESSAGE } : null;
}
