import { eq } from 'drizzle-orm'

import { users } from '@/db/schema'

export const SEED_ADMIN_USAGE =
  'ใช้งาน: npm run seed:admin -- --email someone@ku.th (หรือตั้ง env SEED_ADMIN_EMAIL)'

/**
 * อ่านอีเมลเป้าหมายจาก argument `--email` ก่อน ถ้าไม่มีจึงใช้ env `SEED_ADMIN_EMAIL`
 * คืนค่าเป็นตัวพิมพ์เล็กที่ trim แล้ว หรือ `null` เมื่อไม่มี/ว่างเปล่า
 */
export function parseSeedEmail(
  args: readonly string[],
  env: Record<string, string | undefined>,
): string | null {
  const flagIndex = args.indexOf('--email')
  const fromFlag = flagIndex >= 0 ? args[flagIndex + 1] : undefined
  const raw = fromFlag ?? env.SEED_ADMIN_EMAIL
  const email = raw?.trim().toLowerCase()
  return email ? email : null
}

/**
 * รูปแคบ ๆ ของ Drizzle client ที่สคริปต์ต้องใช้ เพื่อให้เทสต์ฉีด fake ได้
 */
export interface AdminWriteDb {
  update(table: typeof users): {
    set(values: { role: 'admin' }): {
      where(condition: unknown): PromiseLike<{ rowCount: number | null }>
    }
  }
}

/**
 * เลื่อนขั้นผู้ใช้เป็นแอดมินแบบ idempotent — เรียกซ้ำได้ผลเท่าเดิม
 * คืนจำนวนแถวที่ถูกอัปเดต (0 = ไม่พบผู้ใช้อีเมลนี้)
 */
export async function promoteToAdmin(db: AdminWriteDb, email: string): Promise<number> {
  const result = await db
    .update(users)
    .set({ role: 'admin' })
    .where(eq(users.email, email))

  return result.rowCount ?? 0
}
