import 'server-only'

import { forbidden, redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'

import { createSupabaseServerClient } from '@/app/config/supabase-server'
import db from '@/db'
import { users } from '@/db/schema'

/**
 * ข้อมูลผู้ใช้เท่าที่ระบบต้องใช้ตัดสินสิทธิ์ — ไม่ส่งแถว DB ดิบออกไป
 * (Data Access Layer pattern: อ่าน/ตรวจที่เดียว แล้วคืนรูปแคบ ๆ ให้ผู้เรียก)
 */
export type AuthUser = {
  id: string
  email: string
  fullName: string | null
  imageUrl: string | null
  role: 'user' | 'admin'
  isBlocked: boolean
}

/**
 * อ่าน session จาก Supabase แล้วโหลดแถว `users` ที่ตรงกัน
 * คืน `null` เมื่อไม่มี session / ไม่มีอีเมล / ยังไม่มีแถวในฐานข้อมูล
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email) {
    return null
  }

  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1)

  if (!row) {
    return null
  }

  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    imageUrl: row.imageUrl,
    role: row.role,
    isBlocked: row.isBlocked,
  }
}

/**
 * บังคับว่าต้องมีผู้ใช้ที่ใช้งานได้ — ไม่มี session → /login, ถูกบล็อก → /blocked
 * ใช้ใน layout ของกลุ่มเส้นทางที่ต้องล็อกอิน (secure by default)
 */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (user.isBlocked) {
    redirect('/blocked')
  }

  return user
}

/**
 * บังคับว่าต้องเป็นแอดมิน — ผู้ใช้ทั่วไปได้ 403 (forbidden) ตามสัญญาของ Next.js
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser()

  if (user.role !== 'admin') {
    forbidden()
  }

  return user
}
