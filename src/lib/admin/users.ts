import { asc, desc, eq } from "drizzle-orm";

import db from "@/db";
import { users } from "@/db/schema";

/**
 * ชั้นข้อมูล/โดเมนของการจัดการผู้ใช้ (ไม่ใช่ "use server")
 * แยกตรรกะกัน lock-out ที่เป็นฟังก์ชันบริสุทธิ์ออกจากที่แตะฐานข้อมูล
 * เพื่อให้ทดสอบกฎได้ตรง ๆ โดยไม่ต้องมี DB
 */

export type UserRole = "user" | "admin";

/** แถวผู้ใช้แบบแคบเท่าที่หน้าจัดการต้องใช้ — ไม่ส่งแถว DB ดิบออกไป */
export type AdminUserRow = {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  isBlocked: boolean;
  blockedAt: Date | null;
  blockedBy: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
};

/** ผลของการเปลี่ยนบทบาท/การระงับ — คืนรูปเดียวกันให้ UI แสดงข้อความ inline ได้ */
export type UserAdminResult =
  | { ok: true }
  | { ok: false; message: string };

/** การเปลี่ยนแปลงที่กำลังจะทำ ใช้เฉพาะกับตัวกัน lock-out */
export type AdminChange =
  | { type: "role"; role: UserRole }
  | { type: "block"; blocked: boolean };

const LOCKOUT_MESSAGE =
  "ต้องมีผู้ดูแลระบบที่ใช้งานได้อย่างน้อย 1 คน จึงถอดสิทธิ์หรือระงับบัญชีนี้ไม่ได้";

const NOT_FOUND_MESSAGE = "ไม่พบผู้ใช้ที่ต้องการแก้ไข กรุณารีเฟรชหน้าแล้วลองใหม่";

function isActiveAdmin(row: AdminUserRow): boolean {
  return row.role === "admin" && !row.isBlocked;
}

/**
 * ตัวกัน lock-out: "แอดมินที่ใช้งานได้" คือ role='admin' และ is_blocked=false
 * คืนข้อความภาษาไทยเมื่อการเปลี่ยนครั้งนี้จะทำให้เหลือแอดมินที่ใช้งานได้ศูนย์คน
 * มิฉะนั้นคืน null (ปล่อยผ่าน)
 */
export function lastActiveAdminGuard(
  rows: readonly AdminUserRow[],
  targetId: string,
  change: AdminChange,
): string | null {
  const target = rows.find((row) => row.id === targetId);

  if (!target) {
    return NOT_FOUND_MESSAGE;
  }

  if (!isActiveAdmin(target)) {
    return null;
  }

  const keepsActiveAdmin =
    change.type === "role" ? change.role === "admin" : change.blocked === false;

  if (keepsActiveAdmin) {
    return null;
  }

  const otherActiveAdmins = rows.filter(
    (row) => row.id !== targetId && isActiveAdmin(row),
  ).length;

  return otherActiveAdmins > 0 ? null : LOCKOUT_MESSAGE;
}

const USER_COLUMNS = {
  id: users.id,
  email: users.email,
  fullName: users.fullName,
  role: users.role,
  isBlocked: users.isBlocked,
  blockedAt: users.blockedAt,
  blockedBy: users.blockedBy,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
};

/** รายชื่อผู้ใช้ทั้งหมด — แอดมินขึ้นก่อน แล้วเรียงตามลำดับการเข้าระบบ */
export async function listUsers(): Promise<AdminUserRow[]> {
  return db
    .select(USER_COLUMNS)
    .from(users)
    .orderBy(desc(users.role), asc(users.createdAt));
}

/** เปลี่ยนบทบาทผู้ใช้ โดยกันไม่ให้เหลือแอดมินที่ใช้งานได้ศูนย์คน */
export async function changeUserRole(
  targetId: string,
  nextRole: UserRole,
): Promise<UserAdminResult> {
  const rows = await listUsers();

  const guard = lastActiveAdminGuard(rows, targetId, {
    type: "role",
    role: nextRole,
  });

  if (guard) {
    return { ok: false, message: guard };
  }

  const target = rows.find((row) => row.id === targetId);

  if (!target) {
    return { ok: false, message: NOT_FOUND_MESSAGE };
  }

  if (target.role === nextRole) {
    return { ok: true };
  }

  await db.update(users).set({ role: nextRole }).where(eq(users.id, targetId));

  return { ok: true };
}

/**
 * ระงับ/ปลดระงับบัญชี — บันทึกครบตามสัญญา:
 * ระงับ → is_blocked=true, blocked_at=now, blocked_by=actor
 * ปลดระงับ → is_blocked=false, blocked_at=null, blocked_by=null
 */
export async function setUserBlocked(
  actorId: string,
  targetId: string,
  blocked: boolean,
): Promise<UserAdminResult> {
  const rows = await listUsers();

  const guard = lastActiveAdminGuard(rows, targetId, {
    type: "block",
    blocked,
  });

  if (guard) {
    return { ok: false, message: guard };
  }

  const target = rows.find((row) => row.id === targetId);

  if (!target) {
    return { ok: false, message: NOT_FOUND_MESSAGE };
  }

  if (target.isBlocked === blocked) {
    return { ok: true };
  }

  await db
    .update(users)
    .set(
      blocked
        ? { isBlocked: true, blockedAt: new Date(), blockedBy: actorId }
        : { isBlocked: false, blockedAt: null, blockedBy: null },
    )
    .where(eq(users.id, targetId));

  return { ok: true };
}
