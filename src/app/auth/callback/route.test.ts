import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  insertMock,
  exchangeCodeMock,
  getUserMock,
  signOutMock,
} = vi.hoisted(() => {
  const onConflictMock = vi.fn().mockResolvedValue(undefined)
  const valuesMock = vi.fn(() => ({ onConflictDoUpdate: onConflictMock }))
  const insertMock = vi.fn(() => ({ values: valuesMock }))
  const exchangeCodeMock = vi.fn()
  const getUserMock = vi.fn()
  const signOutMock = vi.fn().mockResolvedValue({ error: null })
  return { insertMock, exchangeCodeMock, getUserMock, signOutMock }
})

vi.mock('@/db', () => ({ default: { insert: insertMock } }))
vi.mock('@/app/config/supabase-server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession: exchangeCodeMock,
      getUser: getUserMock,
      signOut: signOutMock,
    },
  })),
}))

import { GET } from './route'

const CALLBACK_URL = 'https://booking.example/auth/callback?code=test-code&next=/profile'

function callbackRequest() {
  return new Request(CALLBACK_URL)
}

describe('auth callback guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    exchangeCodeMock.mockResolvedValue({ error: null })
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1', email: 'user@ku.th' } } })
  })

  it('does not create a user row and signs out a non-ku.th account', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u1', email: 'user@gmail.com' } },
    })

    const response = await GET(callbackRequest())

    expect(insertMock).not.toHaveBeenCalled()
    expect(signOutMock).toHaveBeenCalledTimes(1)
    expect(response.headers.get('location')).toBe(
      'https://booking.example/login?error=ku-domain'
    )
  })

  it('does not create a user row when the provider returns no email', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })

    const response = await GET(callbackRequest())

    expect(insertMock).not.toHaveBeenCalled()
    expect(signOutMock).toHaveBeenCalledTimes(1)
    expect(response.headers.get('location')).toBe(
      'https://booking.example/login?error=ku-domain'
    )
  })

  it('creates exactly one row for a @ku.th account', async () => {
    const response = await GET(callbackRequest())

    expect(insertMock).toHaveBeenCalledTimes(1)
    expect(signOutMock).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toBe('https://booking.example/profile')
  })

  it('redirects with the session error key when the code exchange fails', async () => {
    exchangeCodeMock.mockResolvedValue({ error: { message: 'bad code' } })

    const response = await GET(callbackRequest())

    expect(insertMock).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toBe('https://booking.example/login?error=session')
  })
})
