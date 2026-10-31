import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Supabase ตั้งชื่อคุกกี้ session ว่า `sb-<project-ref>-auth-token` (อาจถูกแบ่งเป็น `.0`, `.1`)
// การเช็คแค่ "มีคุกกี้" เป็นการตรวจแบบ optimistic เท่านั้น
// ด่านจริงอยู่ที่ requireUser()/requireAdmin() ใน layout/route เสมอ
const SUPABASE_AUTH_COOKIE = /^sb-.*-auth-token(\.\d+)?$/

export function hasSupabaseSession(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((cookie) => SUPABASE_AUTH_COOKIE.test(cookie.name))
}

/**
 * Proxy ทำหน้าที่เร่งการเปลี่ยนเส้นทาง: คำขอที่ยังไม่มี session บนเส้นทางที่ต้องล็อกอิน
 * จะถูกพาไป /login ก่อนถึงหน้าเพจ (ไม่ทำ authorization จริง)
 */
export function proxy(request: NextRequest) {
  if (hasSupabaseSession(request)) {
    return NextResponse.next()
  }

  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: [
    /*
     * ตรวจทุกเส้นทาง ยกเว้น:
     * - login (หน้าเข้าสู่ระบบ)
     * - auth/callback (OAuth callback)
     * - blocked (หน้าสำหรับผู้ใช้ที่ถูกบล็อก — ถ้า redirect จะวนลูป)
     * - _next/static, _next/image (ไฟล์ static / image optimization)
     * - favicon.ico และไฟล์ static ที่มีนามสกุล (รูปภาพ ฯลฯ)
     */
    '/((?!login|preview-admin|auth/callback|blocked|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
