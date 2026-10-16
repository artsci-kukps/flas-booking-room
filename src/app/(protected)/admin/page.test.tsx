import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { requireAdminMock } = vi.hoisted(() => ({ requireAdminMock: vi.fn() }))

vi.mock('@/lib/auth/guards', () => ({ requireAdmin: requireAdminMock }))

import AdminPage from './page'

const ADMIN = {
  id: 'a1',
  email: 'admin@ku.th',
  fullName: 'ผู้ดูแล ระบบ',
  imageUrl: null,
  role: 'admin' as const,
  isBlocked: false,
}

describe('admin route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('authorizes through requireAdmin()', async () => {
    requireAdminMock.mockResolvedValue(ADMIN)

    await AdminPage()

    expect(requireAdminMock).toHaveBeenCalledTimes(1)
  })

  it('renders the admin landing page for an admin', async () => {
    requireAdminMock.mockResolvedValue(ADMIN)

    const html = renderToStaticMarkup(await AdminPage())

    expect(html).toContain('ผู้ดูแลระบบ')
  })

  it('propagates the 403 forbiddance for a non-admin', async () => {
    requireAdminMock.mockRejectedValue(new Error('NEXT_HTTP_ERROR_FALLBACK;403'))

    await expect(AdminPage()).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;403')
  })
})
