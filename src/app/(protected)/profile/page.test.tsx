import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { requireUserMock } = vi.hoisted(() => ({ requireUserMock: vi.fn() }))

vi.mock('@/lib/auth/guards', () => ({ requireUser: requireUserMock }))
// ลูกชายเป็น client component — ไม่ต้องเรนเดอร์จริงในเทสต์นี้
vi.mock('./signOutBtn', () => ({ default: () => <button>ออกจากระบบ</button> }))

import ProfilePage from './page'

const USER = {
  id: 'u1',
  email: 'user@ku.th',
  fullName: 'ผู้ใช้ ทดสอบ',
  imageUrl: null,
  role: 'user' as const,
  isBlocked: false,
}

describe('profile page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('authorizes through requireUser()', async () => {
    requireUserMock.mockResolvedValue(USER)

    await ProfilePage()

    expect(requireUserMock).toHaveBeenCalledTimes(1)
  })

  it('renders the signed-in user details', async () => {
    requireUserMock.mockResolvedValue(USER)

    const html = renderToStaticMarkup(await ProfilePage())

    expect(html).toContain('user@ku.th')
    expect(html).toContain('ผู้ใช้ ทดสอบ')
  })

  it('lets the redirect from requireUser() bubble up', async () => {
    requireUserMock.mockRejectedValue(new Error('NEXT_REDIRECT:/login'))

    await expect(ProfilePage()).rejects.toThrow('NEXT_REDIRECT:/login')
  })
})
