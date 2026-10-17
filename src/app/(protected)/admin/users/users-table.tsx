import type { ReactNode } from "react";

import type { AdminUserRow, UserRole } from "@/lib/admin/users";

import UserRowActions from "./user-row-actions";

const ROLE_LABEL: Record<UserRole, string> = {
  user: "ผู้ใช้งาน",
  admin: "ผู้ดูแลระบบ",
};

/** วันที่/เวลาแบบไทย เขตเวลาไทย (ระบบคิดเวลา Asia/Bangkok) */
function formatThaiDateTime(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

/**
 * ชิปสถานะ — เขียว = ใช้งานได้, danger = ถูกระงับ
 * โทน danger สื่อ "ถูกปฏิเสธ/ผิดพลาด" (แดง = denied/error) ตามความหมายเดียวกับ Alert ใน alert.tsx
 */
function StatusChip({ tone, children }: { tone: "active" | "blocked"; children: ReactNode }) {
  const styles =
    tone === "active"
      ? "bg-ku-soft text-ku"
      : "border border-danger-line bg-danger-soft text-danger";
  const dot = tone === "active" ? "bg-ku" : "bg-danger";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${styles}`}
    >
      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      {children}
    </span>
  );
}

function RoleLabel({ role }: { role: UserRole }) {
  return (
    <span className={role === "admin" ? "text-sm font-semibold text-ink" : "text-sm text-ink-muted"}>
      {ROLE_LABEL[role]}
    </span>
  );
}

/**
 * ชื่อที่แสดงได้เสมอ — ใช้ชื่อ-นามสกุลถ้ามี มิฉะนั้นถอยไปใช้ส่วนหน้าอีเมล (ก่อน @)
 * เพื่อให้รายการยังอ่านออกว่าเป็นใคร แทนที่จะขึ้นขีดกลางลอย ๆ
 */
function displayName(user: AdminUserRow): string {
  const fullName = user.fullName?.trim();

  if (fullName) {
    return fullName;
  }

  return user.email.split("@")[0]?.trim() || user.email;
}

function NameLabel({ user, isSelf }: { user: AdminUserRow; isSelf: boolean }) {
  return (
    <div className="min-w-0">
      <p className="font-semibold text-ink">
        {displayName(user)}
        {isSelf ? (
          <span className="ml-1.5 text-xs font-semibold text-ink-muted">(คุณ)</span>
        ) : null}
      </p>
      {user.lastLoginAt ? (
        <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
          เข้าใช้ล่าสุด {formatThaiDateTime(user.lastLoginAt)}
        </p>
      ) : null}
    </div>
  );
}

function StatusLabel({
  user,
  blockedByName,
}: {
  user: AdminUserRow;
  blockedByName: string | null;
}) {
  if (!user.isBlocked) {
    return <StatusChip tone="active">ใช้งานได้</StatusChip>;
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <StatusChip tone="blocked">ถูกระงับ</StatusChip>
      {user.blockedAt ? (
        <p className="text-xs leading-relaxed text-ink-muted">
          ระงับเมื่อ {formatThaiDateTime(user.blockedAt)}
          {blockedByName ? ` โดย ${blockedByName}` : ""}
        </p>
      ) : null}
    </div>
  );
}

type UsersTableProps = {
  rows: AdminUserRow[];
  /** id ของแอดมินที่กำลังดูหน้าอยู่ — ใช้ทำเครื่องหมาย "(คุณ)" */
  currentAdminId: string;
};

/**
 * ตารางรายชื่อผู้ใช้ — ตารางบนจอใหญ่ และการ์ดบนมือถือ
 * แสดงชื่อ อีเมล บทบาท สถานะการระงับ และปุ่มจัดการ (ไม่มีปุ่มลบผู้ใช้)
 */
export default function UsersTable({ rows, currentAdminId }: UsersTableProps) {
  const nameById = new Map(rows.map((row) => [row.id, row.fullName]));

  if (rows.length === 0) {
    return (
      <div className="panel mt-6 p-6">
        <p className="font-semibold text-ink">ยังไม่มีผู้ใช้ในระบบ</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          เมื่อมีผู้เข้าสู่ระบบด้วยอีเมล @ku.th รายชื่อจะแสดงที่นี่
        </p>
      </div>
    );
  }

  return (
    <>
      {/* จอใหญ่: ตาราง */}
      <div className="panel mt-6 hidden overflow-hidden md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">รายชื่อผู้ใช้ในระบบ</caption>
          <thead>
            <tr className="border-b border-border bg-canvas">
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-ink-muted">
                ชื่อ
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-ink-muted">
                อีเมล
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-ink-muted">
                บทบาท
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-ink-muted">
                สถานะ
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-ink-muted">
                จัดการ
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((user) => (
              <tr key={user.id} className="align-top transition-colors hover:bg-canvas">
                <td className="px-4 py-4">
                  <NameLabel user={user} isSelf={user.id === currentAdminId} />
                </td>
                <td className="px-4 py-4 text-sm text-ink-muted">{user.email}</td>
                <td className="px-4 py-4">
                  <RoleLabel role={user.role} />
                </td>
                <td className="px-4 py-4">
                  <StatusLabel
                    user={user}
                    blockedByName={
                      user.blockedBy ? (nameById.get(user.blockedBy) ?? null) : null
                    }
                  />
                </td>
                <td className="px-4 py-4">
                  <UserRowActions
                    id={user.id}
                    role={user.role}
                    isBlocked={user.isBlocked}
                    isSelf={user.id === currentAdminId}
                    className="justify-end"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* มือถือ: การ์ด */}
      <ul className="mt-6 grid gap-3 md:hidden">
        {rows.map((user) => (
          <li key={user.id} className="panel p-4">
            <div className="flex items-start justify-between gap-3">
              <NameLabel user={user} isSelf={user.id === currentAdminId} />
              <StatusLabel
                user={user}
                blockedByName={user.blockedBy ? (nameById.get(user.blockedBy) ?? null) : null}
              />
            </div>
            <p className="mt-3 truncate text-sm text-ink-muted">{user.email}</p>
            <p className="mt-1 text-xs text-ink-muted">
              บทบาท: <RoleLabel role={user.role} />
            </p>
            <UserRowActions
              id={user.id}
              role={user.role}
              isBlocked={user.isBlocked}
              isSelf={user.id === currentAdminId}
              className="mt-3"
            />
          </li>
        ))}
      </ul>
    </>
  );
}
