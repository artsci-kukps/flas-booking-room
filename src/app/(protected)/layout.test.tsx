import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { requireUserMock } = vi.hoisted(() => ({ requireUserMock: vi.fn() }))

vi.mock('@/lib/auth/guards', () => ({ requireUser: requireUserMock }))

import ProtectedLayout from './layout'

describe('protected layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires a usable user before rendering children', async () => {
    requireUserMock.mockResolvedValue({ id: 'u1' })

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
