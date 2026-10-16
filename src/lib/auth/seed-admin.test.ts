import { describe, expect, it, vi } from 'vitest'

import { users } from '@/db/schema'
import { parseSeedEmail, promoteToAdmin, type AdminWriteDb } from './seed-admin'

describe('parseSeedEmail', () => {
  it('reads the email after the --email flag', () => {
    expect(parseSeedEmail(['--email', 'Admin@KU.th'], {})).toBe('admin@ku.th')
  })

  it('falls back to SEED_ADMIN_EMAIL', () => {
    expect(parseSeedEmail([], { SEED_ADMIN_EMAIL: ' admin@ku.th ' })).toBe('admin@ku.th')
  })

  it('prefers the flag over the environment variable', () => {
    expect(
      parseSeedEmail(['--email', 'flag@ku.th'], { SEED_ADMIN_EMAIL: 'env@ku.th' }),
    ).toBe('flag@ku.th')
  })

  it('returns null when no email is provided', () => {
    expect(parseSeedEmail([], {})).toBeNull()
  })

  it('returns null when the flag has no value', () => {
    expect(parseSeedEmail(['--email'], {})).toBeNull()
  })

  it('ignores blank values', () => {
    expect(parseSeedEmail([], { SEED_ADMIN_EMAIL: '   ' })).toBeNull()
  })
})

function fakeAdminDb(rowCount: number | null) {
  const calls: {
    table?: unknown
    values?: unknown
    condition?: unknown
  } = {}

  const where = vi.fn(async (condition: unknown) => {
    calls.condition = condition
    return { rowCount }
  })
  const set = vi.fn((values: unknown) => {
    calls.values = values
    return { where }
  })
  const update = vi.fn((table: unknown) => {
    calls.table = table
    return { set }
  })

  return { db: { update } as unknown as AdminWriteDb, calls }
}

describe('promoteToAdmin', () => {
  it('updates the users table, setting role to admin', async () => {
    const { db, calls } = fakeAdminDb(1)

    await promoteToAdmin(db, 'admin@ku.th')

    expect(calls.table).toBe(users)
    expect(calls.values).toEqual({ role: 'admin' })
    expect(calls.condition).toBeDefined()
  })

  it('returns the number of updated rows', async () => {
    const { db } = fakeAdminDb(1)

    await expect(promoteToAdmin(db, 'admin@ku.th')).resolves.toBe(1)
  })

  it('treats a null rowCount as zero', async () => {
    const { db } = fakeAdminDb(null)

    await expect(promoteToAdmin(db, 'nobody@ku.th')).resolves.toBe(0)
  })
})
