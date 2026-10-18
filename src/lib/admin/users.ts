import { asc, desc, eq, sql } from "drizzle-orm";

import db from "@/db";
import { users } from "@/db/schema";

import type { Result } from "@/lib/result";

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
export type UserAdminResult = Result;

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

/**
 * คีย์ล็อกแบบ advisory ระดับ transaction สำหรับ serialize การแก้ไขผู้ใช้
 * ใช้ค่าคงที่ร่วมกันทั้งระบบ เพื่อให้ mutation ผู้ใช้ทุกครั้งเข้าคิวทีละราย
 * ป้องกันสองคำขอถอดสิทธิ์/ระงับแอดมินพร้อมกันแล้วผ่านตัวกัน lock-out ทั้งคู่
 */
const USER_MUTATION_LOCK_KEY = 48_202_003;

type UserAdminTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** อ่านแถวผู้ใช้ทั้งหมดผ่าน executor ที่ให้มา (db ปกติ หรือ tx ในทรานแซกชัน) */
async function selectUserRows(
  executor: Pick<UserAdminTransaction, "select">,
): Promise<AdminUserRow[]> {
  return executor
    .select(USER_COLUMNS)
    .from(users)
    .orderBy(desc(users.role), asc(users.createdAt));
}

/** รายชื่อผู้ใช้ทั้งหมด — แอดมินขึ้นก่อน แล้วเรียงตามลำดับการเข้าระบบ */
export async function listUsers(): Promise<AdminUserRow[]> {
  return selectUserRows(db);
}

/**
 * โครงร่วมของการแก้ไขผู้ใช้ทุกแบบ — ทำงานในทรานแซกชันเดียวเพื่อความ atomic:
 * 1) ถือ advisory lock ให้ mutation ผู้ใช้เข้าคิวทีละราย
 * 2) อ่านสถานะผู้ใช้ล่าสุด "ภายใน" ทรานแซกชัน (ไม่ใช่ค่าที่อ่านมาก่อนหน้า)
 * 3) รันตัวกัน lock-out บนข้อมูลล่าสุดนั้น
 * 4) ถ้าเป็นการเปลี่ยนแปลงที่เป็น no-op หรือเป้าหมายหายไป ก็จบโดยไม่เขียน
 * 5) เขียนเฉพาะเมื่อผ่านตัวกันแล้วเท่านั้น
 */
async function mutateUser(
  targetId: string,
  change: AdminChange,
  isNoOp: (target: AdminUserRow) => boolean,
  apply: (tx: UserAdminTransaction) => Promise<unknown>,
): Promise<UserAdminResult> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${USER_MUTATION_LOCK_KEY})`);

    const rows = await selectUserRows(tx);

    const guard = lastActiveAdminGuard(rows, targetId, change);

    if (guard) {
      return { ok: false, message: guard };
    }

    const target = rows.find((row) => row.id === targetId);

    if (!target) {
      return { ok: false, message: NOT_FOUND_MESSAGE };
    }

    if (isNoOp(target)) {
      return { ok: true };
    }

    await apply(tx);

    return { ok: true };
  });
}

/** เปลี่ยนบทบาทผู้ใช้ โดยกันไม่ให้เหลือแอดมินที่ใช้งานได้ศูนย์คน */
export async function changeUserRole(
  targetId: string,
  nextRole: UserRole,
): Promise<UserAdminResult> {
  return mutateUser(
    targetId,
    { type: "role", role: nextRole },
    (target) => target.role === nextRole,
    (tx) => tx.update(users).set({ role: nextRole }).where(eq(users.id, targetId)),
  );
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
  return mutateUser(
    targetId,
    { type: "block", blocked },
    (target) => target.isBlocked === blocked,
    (tx) =>
      tx
        .update(users)
        .set(
          blocked
            ? { isBlocked: true, blockedAt: new Date(), blockedBy: actorId }
            : { isBlocked: false, blockedAt: null, blockedBy: null },
        )
        .where(eq(users.id, targetId)),
  );
}
