/**
 * เลื่อนขั้นผู้ใช้เป็นแอดมินคนแรกโดยตรงผ่านฐานข้อมูล (ตาม TOR §3.3)
 * หลังตั้งแอดมินคนแรกแล้ว จะ seed ช่วงเวลาให้บริการ NORMAL เริ่มต้น 08:30–16:30
 * ให้อัตโนมัติ (TOR ภาคผนวก B ข้อ 1 — เรียกซ้ำได้ ไม่สร้างซ้ำ)
 *
 * รัน:
 *   npm run seed:admin -- --email someone@ku.th
 *   # หรือ
 *   SEED_ADMIN_EMAIL=someone@ku.th npm run seed:admin
 *
 * ทดลองแบบไม่เขียนข้อมูล:
 *   npm run seed:admin -- --email someone@ku.th --dry-run
 *
 * หมายเหตุ: ผู้ใช้ต้องเข้าสู่ระบบอย่างน้อย 1 ครั้งก่อน เพื่อให้มีแถวในตาราง users
 */
import { parseSeedEmail, promoteToAdmin, SEED_ADMIN_USAGE } from '@/lib/auth/seed-admin'

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const email = parseSeedEmail(args, process.env)

  if (!email) {
    console.error(SEED_ADMIN_USAGE)
    process.exitCode = 1
    return
  }

  if (dryRun) {
    console.log(`[dry-run] จะเลื่อนขั้น ${email} เป็น role=admin (ไม่ได้เขียนฐานข้อมูล)`)
    return
  }

  // import แบบไดนามิกเพื่อให้โหมด --dry-run ไม่ต้องเปิดการเชื่อมต่อฐานข้อมูลเลย
  const { default: db } = await import('@/db')

  const updated = await promoteToAdmin(db, email)
  if (updated === 0) {
    console.error(
      `ไม่พบผู้ใช้ ${email} ในฐานข้อมูล — ผู้ใช้ต้องเข้าสู่ระบบอย่างน้อย 1 ครั้งก่อน`,
    )
    process.exitCode = 1
    return
  }

  console.log(`เลื่อนขั้น ${email} เป็น role=admin สำเร็จ (${updated} แถว)`)

  // หลังตั้งแอดมินคนแรก: seed ช่วง NORMAL เริ่มต้น 08:30–16:30 (idempotent — เรียกซ้ำได้)
  const { ensureDefaultServicePeriod } = await import('@/lib/admin/service-periods')
  const seeded = await ensureDefaultServicePeriod(email)

  if (seeded === 'created') {
    console.log('Seed ช่วงเวลาให้บริการ NORMAL เริ่มต้น 08:30–16:30 สำเร็จ')
  } else if (seeded === 'skipped') {
    console.log('มีช่วงเวลา NORMAL อยู่แล้ว — ข้ามการ seed')
  } else {
    console.warn(`ไม่พบผู้ใช้ ${email} ในตาราง users จึงไม่ได้ seed ช่วงเวลาให้บริการ`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
