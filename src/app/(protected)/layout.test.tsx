import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { requireUserMock } = vi.hoisted(() => ({ requireUserMock: vi.fn() }))

vi.mock('@/lib/auth/guards', () => ({ requireUser: requireUserMock }))
// AppHeader เป็น client component ที่อ่านเส้นทางปัจจุบัน — จำลอง router context ให้ render ได้ในโหมด static
vi.mock('next/navigation', () => ({
  usePathname: () => '/user',
  useRouter: () => ({ push: vi.fn() }),
}))

import ProtectedLayout from './layout'

describe('protected layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires a usable user before rendering children', async () => {
    requireUserMock.mockResolvedValue({
      id: 'u1',
      email: 'user@ku.th',
      fullName: null,
      imageUrl: null,
      role: 'user' as const,
      isBlocked: false,
    })

    const html = renderToStaticMarkup(
      await ProtectedLayout({ children: <span>เนื้อหา</span> }),
    )

    expect(requireUserMock).toHaveBeenCalledTimes(1)
    expect(html).toContain('เนื้อหา')
  })

  it('lets the redirect from requireUser() bubble up', async () => {
    requireUserMock.mockRejectedValue(new Error('NEXT_REDIRECT:/login'))

    await expect(
      ProtectedLayout({ children: <span>เนื้อหา</span> }),
    ).rejects.toThrow('NEXT_REDIRECT:/login')
  })
})
