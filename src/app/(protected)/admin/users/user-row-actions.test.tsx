import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('./actions', () => ({
  updateUserRole: vi.fn(),
  updateUserBlocked: vi.fn(),
}))

import UserRowActions from './user-row-actions'

/** ดึงข้อความบนปุ่มทั้งหมดออกจาก HTML ที่เรนเดอร์ */
function buttonLabels(html: string): string[] {
  return [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((match) =>
    match[1]!.replace(/<[^>]*>/g, '').trim(),
  )
}

describe('UserRowActions', () => {
  it('แสดงปุ่มเลื่อนเป็นแอดมินและระงับสำหรับผู้ใช้ทั่วไป', () => {
    const html = renderToStaticMarkup(
      <UserRowActions id="u1" role="user" isBlocked={false} isSelf={false} />,
    )

    expect(buttonLabels(html)).toEqual(['ตั้งเป็นผู้ดูแลระบบ', 'ระงับการใช้งาน'])
  })

  it('ส่งค่าเป้าหมายและบทบาทใหม่ไปกับฟอร์ม', () => {
    const html = renderToStaticMarkup(
      <UserRowActions id="u1" role="user" isBlocked={false} isSelf={false} />,
    )

    expect(html).toContain('name="targetId" value="u1"')
    expect(html).toContain('name="role" value="admin"')
    expect(html).toContain('name="blocked" value="true"')
  })

  it('แสดงปุ่มถอดสิทธิ์ตัวเองและปลดระงับสำหรับแอดมินที่ถูกระงับ', () => {
    const html = renderToStaticMarkup(
      <UserRowActions id="a1" role="admin" isBlocked={true} isSelf={true} />,
    )

    expect(buttonLabels(html)).toEqual(['ถอดสิทธิ์ตัวเอง', 'ปลดการระงับ'])
    expect(html).toContain('name="role" value="user"')
    expect(html).toContain('name="blocked" value="false"')
  })

  it('ไม่มีปุ่มหรือกลไกลบผู้ใช้ใด ๆ', () => {
    const html = renderToStaticMarkup(
      <UserRowActions id="u1" role="user" isBlocked={false} isSelf={false} />,
    )

    expect(buttonLabels(html).some((label) => label.includes('ลบ'))).toBe(false)
  })
})
