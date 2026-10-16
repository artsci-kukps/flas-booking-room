import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getUserMock,
  selectMock,
  limitMock,
  redirectMock,
  forbiddenMock,
} = vi.hoisted(() => {
  const limitMock = vi.fn()
  const whereMock = vi.fn(() => ({ limit: limitMock }))
  const fromMock = vi.fn(() => ({ where: whereMock }))
  const selectMock = vi.fn(() => ({ from: fromMock }))
  const getUserMock = vi.fn()
  // redirect()/forbidden() ของจริงขว้าง error เพื่อหยุดการเรนเดอร์ — เลียนแบบให้ตรง
  const redirectMock = vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  })
  const forbiddenMock = vi.fn(() => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;403')
  })
  return {
    getUserMock,
    selectMock,
    limitMock,
    redirectMock,
    forbiddenMock,
  }
})

vi.mock('@/db', () => ({ default: { select: selectMock } }))
vi.mock('@/app/config/supabase-server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
  })),
}))
vi.mock('next/navigation', () => ({
  redirect: redirectMock,
  forbidden: forbiddenMock,
}))

import { getCurrentUser, requireAdmin, requireUser, requireUserArea } from './guards'

const ACTIVE_USER = {
  id: 'u1',
  email: 'user@ku.th',
  fullName: 'ผู้ใช้ ทดสอบ',
  imageUrl: 'https://example.com/a.png',
  role: 'user' as const,
  isBlocked: false,
  blockedAt: null,
  blockedBy: null,
  lastLoginAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
}

const ADMIN_USER = { ...ACTIVE_USER, id: 'a1', email: 'admin@ku.th', role: 'admin' as const }
const BLOCKED_USER = { ...ACTIVE_USER, id: 'b1', isBlocked: true }

describe('getCurrentUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1', email: 'user@ku.th' } } })
    limitMock.mockResolvedValue([ACTIVE_USER])
  })

  it('returns null without touching the DB when there is no session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })

    await expect(getCurrentUser()).resolves.toBeNull()
    expect(selectMock).not.toHaveBeenCalled()
  })

  it('returns null when the provider omits the email', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })

    await expect(getCurrentUser()).resolves.toBeNull()
    expect(selectMock).not.toHaveBeenCalled()
  })

  it('returns null when no matching users row exists', async () => {
    limitMock.mockResolvedValue([])

    await expect(getCurrentUser()).resolves.toBeNull()
  })

  it('returns only the narrow auth shape for the matching row', async () => {
    await expect(getCurrentUser()).resolves.toEqual({
      id: 'u1',
      email: 'user@ku.th',
      fullName: 'ผู้ใช้ ทดสอบ',
      imageUrl: 'https://example.com/a.png',
      role: 'user',
      isBlocked: false,
    })
  })
})

describe('requireUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1', email: 'user@ku.th' } } })
    limitMock.mockResolvedValue([ACTIVE_USER])
  })

  it('redirects to /login when there is no session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })

    await expect(requireUser()).rejects.toThrow('NEXT_REDIRECT:/login')

    expect(redirectMock).toHaveBeenCalledWith('/login')
  })

  it('redirects a blocked user to /blocked', async () => {
    limitMock.mockResolvedValue([BLOCKED_USER])

    await expect(requireUser()).rejects.toThrow('NEXT_REDIRECT:/blocked')

    expect(redirectMock).toHaveBeenCalledWith('/blocked')
  })

  it('returns the user without redirecting for an active user', async () => {
    const user = await requireUser()

    expect(redirectMock).not.toHaveBeenCalled()
    expect(user.id).toBe('u1')
  })
})

describe('requireAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1', email: 'user@ku.th' } } })
    limitMock.mockResolvedValue([ACTIVE_USER])
  })

  it('calls forbidden() for a non-admin user', async () => {
    await expect(requireAdmin()).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;403')

    expect(forbiddenMock).toHaveBeenCalledTimes(1)
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('returns the admin user without calling forbidden()', async () => {
    limitMock.mockResolvedValue([ADMIN_USER])

    const user = await requireAdmin()

    expect(forbiddenMock).not.toHaveBeenCalled()
    expect(user.role).toBe('admin')
  })
})

describe('requireUserArea', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1', email: 'user@ku.th' } } })
    limitMock.mockResolvedValue([ACTIVE_USER])
  })

  it('lets a regular user into the /user routes', async () => {
    const user = await requireUserArea()

    expect(redirectMock).not.toHaveBeenCalled()
    expect(user.role).toBe('user')
  })

  it('keeps admins out of the /user routes by sending them to /admin/booking', async () => {
    limitMock.mockResolvedValue([ADMIN_USER])

    await expect(requireUserArea()).rejects.toThrow('NEXT_REDIRECT:/admin/booking')

    expect(redirectMock).toHaveBeenCalledWith('/admin/booking')
    expect(forbiddenMock).not.toHaveBeenCalled()
  })

  it('still inherits the session and blocked checks from requireUser()', async () => {
    limitMock.mockResolvedValue([BLOCKED_USER])

    await expect(requireUserArea()).rejects.toThrow('NEXT_REDIRECT:/blocked')
  })
})
