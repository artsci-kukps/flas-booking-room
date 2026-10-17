import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { requireAdminMock, listUsersMock, changeUserRoleMock, setUserBlockedMock } = vi.hoisted(
  () => ({
    requireAdminMock: vi.fn(),
    listUsersMock: vi.fn(),
    changeUserRoleMock: vi.fn(),
    setUserBlockedMock: vi.fn(),
  }),
)

vi.mock('@/lib/auth/guards', () => ({ requireAdmin: requireAdminMock }))
vi.mock('@/lib/admin/users', () => ({
  listUsers: listUsersMock,
  changeUserRole: changeUserRoleMock,
  setUserBlocked: setUserBlockedMock,
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import type { AdminUserRow } from '@/lib/admin/users'
import UsersPage from './page'

function user(overrides: Partial<AdminUserRow> & Pick<AdminUserRow, 'id'>): AdminUserRow {
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

const ADMIN = {
  id: 'a1',
  email: 'admin@ku.th',
  fullName: 'ผู้ดูแล ระบบ',
  imageUrl: null,
  role: 'admin' as const,
  isBlocked: false,
}

const A1 = user({ id: 'a1', fullName: 'ผู้ดูแล ระบบ', role: 'admin' })
const U1 = user({ id: 'u1', fullName: 'สมชาย ใจดี', email: 'somchai@ku.th' })
const U2 = user({
  id: 'u2',
  fullName: 'สมหญิง รักเรียน',
  email: 'somying@ku.th',
  isBlocked: true,
  blockedAt: new Date('2026-02-01T03:00:00Z'),
  blockedBy: 'a1',
})

/** ดึงข้อความบนปุ่มทั้งหมดออกจาก HTML ที่เรนเดอร์ */
function buttonLabels(html: string): string[] {
  return [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((match) =>
    match[1]!.replace(/<[^>]*>/g, '').trim(),
  )
}

describe('users page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminMock.mockResolvedValue(ADMIN)
    listUsersMock.mockResolvedValue([A1, U1, U2])
  })

  it('ตรวจสิทธิ์แอดมินก่อนแสดงรายชื่อ', async () => {
    await UsersPage()

    expect(requireAdminMock).toHaveBeenCalledTimes(1)
  })

  it('แสดงชื่อ อีเมล บทบาท และสถานะการระงับของผู้ใช้แต่ละคน', async () => {
    const html = renderToStaticMarkup(await UsersPage())

    expect(html).toContain('สมชาย ใจดี')
    expect(html).toContain('somchai@ku.th')
    expect(html).toContain('ผู้ดูแลระบบ')
    expect(html).toContain('ผู้ใช้งาน')
    expect(html).toContain('ใช้งานได้')
    expect(html).toContain('ถูกระงับ')
  })

  it('ระบุผู้ที่ทำการระงับไว้ในรายการ', async () => {
    const html = renderToStaticMarkup(await UsersPage())

    expect(html).toContain('ระงับเมื่อ')
    expect(html).toContain('โดย ผู้ดูแล ระบบ')
  })

  it('ไม่มีปุ่มหรือกลไกลบผู้ใช้ใด ๆ', async () => {
    const html = renderToStaticMarkup(await UsersPage())

    expect(buttonLabels(html).some((label) => label.includes('ลบ'))).toBe(false)
  })

  it('แสดงข้อความว่างเมื่อยังไม่มีผู้ใช้', async () => {
    listUsersMock.mockResolvedValue([])

    const html = renderToStaticMarkup(await UsersPage())

    expect(html).toContain('ยังไม่มีผู้ใช้ในระบบ')
  })
})
