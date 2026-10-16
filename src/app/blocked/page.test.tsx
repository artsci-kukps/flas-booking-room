import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { getCurrentUserMock, redirectMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))

vi.mock('@/lib/auth/guards', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('next/navigation', () => ({ redirect: redirectMock }))

import BlockedPage from './page'

describe('blocked page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends a visitor with no session back to /login', async () => {
    getCurrentUserMock.mockResolvedValue(null)

    await expect(BlockedPage()).rejects.toThrow('NEXT_REDIRECT:/login')
  })

  it('leaves a non-blocked user to the app instead of looping', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'u1', isBlocked: false })

    await expect(BlockedPage()).rejects.toThrow('NEXT_REDIRECT:/')
  })

  it('shows the notice for a blocked user', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'b1', isBlocked: true })

    const html = renderToStaticMarkup(await BlockedPage())

    expect(html).toContain('บัญชีนี้ถูกระงับการใช้งาน')
    expect(redirectMock).not.toHaveBeenCalled()
  })
})
