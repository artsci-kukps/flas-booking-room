import type { AdminUserRow } from '@/lib/admin/users'

/**
 * ตัวช่วยร่วมของเทสต์หน้าจัดการผู้ใช้ — รวมไว้ที่เดียวเพื่อไม่ให้
 * โครงข้อมูลผู้ใช้และตัวดึงป้ายปุ่มซ้ำกันหลายไฟล์
 */

/** แถวผู้ใช้ตัวอย่าง — เติมค่าเริ่มต้นให้ครบ แล้วทับด้วย overrides */
export function makeUser(
  overrides: Partial<AdminUserRow> & Pick<AdminUserRow, 'id'>,
): AdminUserRow {
  return {
    email: `${overrides.id}@ku.th`,
    fullName: null,
    role: 'user',
    isBlocked: false,
    blockedAt: null,
    blockedBy: null,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

/** ค่าที่ requireAdmin() คืนในเทสต์ (แอดมินที่กำลังใช้งาน) */
export const ADMIN = {
  id: 'a1',
  email: 'admin@ku.th',
  fullName: 'ผู้ดูแล ระบบ',
  imageUrl: null,
  role: 'admin' as const,
  isBlocked: false,
}

/** ดึงข้อความบนปุ่มทั้งหมดออกจาก HTML ที่เรนเดอร์ */
export function buttonLabels(html: string): string[] {
  return [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((match) =>
    match[1]!.replace(/<[^>]*>/g, '').trim(),
  )
}
