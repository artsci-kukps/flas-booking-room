import { beforeEach, describe, expect, it, vi } from 'vitest'

const { orderByMock, setMock, whereMock, selectMock, updateMock } = vi.hoisted(() => {
  const orderByMock = vi.fn()
  const fromMock = vi.fn(() => ({ orderBy: orderByMock }))
  const selectMock = vi.fn(() => ({ from: fromMock }))

  const whereMock = vi.fn()
  const setMock = vi.fn(() => ({ where: whereMock }))
  const updateMock = vi.fn(() => ({ set: setMock }))

  return { orderByMock, setMock, whereMock, selectMock, updateMock, fromMock }
})

vi.mock('@/db', () => ({
  default: { select: selectMock, update: updateMock },
}))

import {
  changeUserRole,
  lastActiveAdminGuard,
  listUsers,
  setUserBlocked,
  type AdminUserRow,
} from './users'

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

const A1 = user({ id: 'a1', role: 'admin' })
const A2 = user({ id: 'a2', role: 'admin' })
const A_BLOCKED = user({ id: 'b1', role: 'admin', isBlocked: true })
const U1 = user({ id: 'u1' })

describe('lastActiveAdminGuard', () => {
  it('ปล่อยผ่านเมื่อเป้าหมายไม่ใช่แอดมินที่ใช้งานได้', () => {
    const rows = [A1, U1]

    expect(lastActiveAdminGuard(rows, 'u1', { type: 'role', role: 'user' })).toBeNull()
  })

  it('กันการถอดสิทธิ์แอดมินคนสุดท้ายที่ใช้งานได้', () => {
    const rows = [A1, U1]

    const reason = lastActiveAdminGuard(rows, 'a1', { type: 'role', role: 'user' })

    expect(reason).toBeTypeOf('string')
    expect(reason).not.toBe('')
  })

  it('ปล่อยผ่านเมื่อยังเหลือแอดมินที่ใช้งานได้คนอื่น', () => {
    const rows = [A1, A2, U1]

    expect(lastActiveAdminGuard(rows, 'a1', { type: 'role', role: 'user' })).toBeNull()
  })

  it('ไม่นับแอดมินที่ถูกระงับว่าเป็นแอดมินที่ใช้งานได้', () => {
    const rows = [A1, A_BLOCKED]

    const reason = lastActiveAdminGuard(rows, 'a1', { type: 'block', blocked: true })

    expect(reason).toBeTypeOf('string')
  })

  it('กันการระงับแอดมินที่ใช้งานได้คนสุดท้าย', () => {
    const rows = [A1, U1]

    expect(lastActiveAdminGuard(rows, 'a1', { type: 'block', blocked: true })).toBeTypeOf('string')
  })

  it('ปล่อยผ่านการระงับผู้ใช้ทั่วไป', () => {
    const rows = [A1, U1]

    expect(lastActiveAdminGuard(rows, 'u1', { type: 'block', blocked: true })).toBeNull()
  })

  it('ปล่อยผ่านการปลดระงับเสมอ', () => {
    const rows = [A_BLOCKED]

    expect(lastActiveAdminGuard(rows, 'b1', { type: 'block', blocked: false })).toBeNull()
  })

  it('ปล่อยผ่านการเลื่อนเป็นแอดมิน', () => {
    const rows = [A1, U1]

    expect(lastActiveAdminGuard(rows, 'u1', { type: 'role', role: 'admin' })).toBeNull()
  })

  it('แจ้งอย่างเป็นมิตรเมื่อไม่พบผู้ใช้', () => {
    const reason = lastActiveAdminGuard([A1], 'missing', { type: 'role', role: 'user' })

    expect(reason).toBeTypeOf('string')
    expect(reason).not.toBe('')
  })
})

describe('listUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('คืนแถวแบบแคบที่ได้จาก query', async () => {
    orderByMock.mockResolvedValue([A1, U1])

    await expect(listUsers()).resolves.toEqual([A1, U1])
  })
})

describe('changeUserRole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    whereMock.mockResolvedValue(undefined)
  })

  it('ถอดสิทธิ์แอดมินคนสุดท้ายไม่ได้ และไม่เขียนฐานข้อมูล', async () => {
    orderByMock.mockResolvedValue([A1, U1])

    const result = await changeUserRole('a1', 'user')

    expect(result).toMatchObject({ ok: false })
    expect(setMock).not.toHaveBeenCalled()
  })

  it('เปลี่ยนบทบาท user → admin ได้เมื่อยังเหลือแอดมินใช้งานได้', async () => {
    orderByMock.mockResolvedValue([A1, U1])

    const result = await changeUserRole('u1', 'admin')

    expect(result).toEqual({ ok: true })
    expect(setMock).toHaveBeenCalledWith({ role: 'admin' })
    expect(whereMock).toHaveBeenCalled()
  })

  it('เปลี่ยน admin → user ได้เมื่อยังเหลือแอดมินใช้งานได้คนอื่น', async () => {
    orderByMock.mockResolvedValue([A1, A2, U1])

    const result = await changeUserRole('a1', 'user')

    expect(result).toEqual({ ok: true })
    expect(setMock).toHaveBeenCalledWith({ role: 'user' })
  })

  it('ไม่เขียนฐานข้อมูลเมื่อบทบาทเดิมตรงกับที่ต้องการ', async () => {
    orderByMock.mockResolvedValue([A1, U1])

    const result = await changeUserRole('u1', 'user')

    expect(result).toEqual({ ok: true })
    expect(setMock).not.toHaveBeenCalled()
  })
})

describe('setUserBlocked', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    whereMock.mockResolvedValue(undefined)
  })

  it('บันทึก is_blocked, blocked_at, blocked_by = ผู้ดำเนินการ', async () => {
    orderByMock.mockResolvedValue([A1, U1])

    const result = await setUserBlocked('a1', 'u1', true)

    expect(result).toEqual({ ok: true })
    expect(setMock).toHaveBeenCalledWith({
      isBlocked: true,
      blockedAt: expect.any(Date),
      blockedBy: 'a1',
    })
  })

  it('ปลดระงับโดยล้าง blocked_at/blocked_by และตั้ง is_blocked=false', async () => {
    orderByMock.mockResolvedValue([A1, { ...U1, isBlocked: true, blockedAt: new Date(), blockedBy: 'a1' }])

    const result = await setUserBlocked('a1', 'u1', false)

    expect(result).toEqual({ ok: true })
    expect(setMock).toHaveBeenCalledWith({
      isBlocked: false,
      blockedAt: null,
      blockedBy: null,
    })
  })

  it('ระงับแอดมินที่ใช้งานได้คนสุดท้ายไม่ได้', async () => {
    orderByMock.mockResolvedValue([A1, U1])

    const result = await setUserBlocked('a1', 'a1', true)

    expect(result).toMatchObject({ ok: false })
    expect(setMock).not.toHaveBeenCalled()
  })
})
