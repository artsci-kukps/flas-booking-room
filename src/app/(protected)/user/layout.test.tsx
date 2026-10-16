import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { requireUserAreaMock, pathnameMock } = vi.hoisted(() => ({
  requireUserAreaMock: vi.fn(),
  pathnameMock: { value: '/user/booking' },
}))

vi.mock('@/lib/auth/guards', () => ({ requireUserArea: requireUserAreaMock }))
// AppHeader อ่านเส้นทางปัจจุบัน — จำลอง router context ให้ render ได้ในโหมด static
vi.mock('next/navigation', () => ({
  usePathname: () => pathnameMock.value,
  useRouter: () => ({ push: vi.fn() }),
}))

import UserAreaLayout from './layout'

describe('user area layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pathnameMock.value = '/user/booking'
  })

  it('runs the /user area guard before rendering children', async () => {
    requireUserAreaMock.mockResolvedValue({
      id: 'u1',
      email: 'user@ku.th',
      fullName: null,
      imageUrl: null,
      role: 'user' as const,
      isBlocked: false,
    })

    const html = renderToStaticMarkup(
      await UserAreaLayout({ children: <span>เนื้อหา</span> }),
    )

    expect(requireUserAreaMock).toHaveBeenCalledTimes(1)
    expect(html).toContain('เนื้อหา')
  })

  it('lets the redirect for an admin bubble up', async () => {
    requireUserAreaMock.mockRejectedValue(
      new Error('NEXT_REDIRECT:/admin/booking'),
    )

    await expect(
      UserAreaLayout({ children: <span>เนื้อหา</span> }),
    ).rejects.toThrow('NEXT_REDIRECT:/admin/booking')
  })
})
