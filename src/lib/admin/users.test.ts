import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeUser } from '@/app/(protected)/admin/users/test-fixtures'

const { orderByMock, setMock, whereMock, selectMock, updateMock, executeMock, transactionMock } =
  vi.hoisted(() => {
    const orderByMock = vi.fn()
    const fromMock = vi.fn(() => ({ orderBy: orderByMock }))
    const selectMock = vi.fn(() => ({ from: fromMock }))

    const whereMock = vi.fn()
    const setMock = vi.fn(() => ({ where: whereMock }))
    const updateMock = vi.fn(() => ({ set: setMock }))

    // ทรานแซกชันจำลอง: เรียก callback ด้วย tx ที่มี select/update/execute ตัวเดียวกับ db
    const executeMock = vi.fn()
    const transactionMock = vi.fn(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({ select: selectMock, update: updateMock, execute: executeMock }),
    )

    return {
      orderByMock,
      setMock,
      whereMock,
      selectMock,
      updateMock,
      executeMock,
      transactionMock,
    }
  })

vi.mock('@/db', () => ({
  default: {
    select: selectMock,
    update: updateMock,
    transaction: transactionMock,
  },
}))

import { changeUserRole, lastActiveAdminGuard, listUsers, setUserBlocked } from './users'

const A1 = makeUser({ id: 'a1', role: 'admin' })
const A2 = makeUser({ id: 'a2', role: 'admin' })
const A_BLOCKED = makeUser({ id: 'b1', role: 'admin', isBlocked: true })
const U1 = makeUser({ id: 'u1' })

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
    executeMock.mockResolvedValue(undefined)
  })

  it('ถอดสิทธิ์แอดมินคนสุดท้ายไม่ได้ และไม่เขียนฐานข้อมูล', async () => {
    orderByMock.mockResolvedValue([A1, U1])

    const result = await changeUserRole('a1', 'user')

    expect(result).toMatchObject({ ok: false })
    expect(setMock).not.toHaveBeenCalled()
  })

  it('อ่านสถานะและกัน lock-out ภายในทรานแซกชันเดียวกัน', async () => {
    orderByMock.mockResolvedValue([A1, U1])

    await changeUserRole('a1', 'user')

    // ตัวกันต้องอ่านข้อมูลภายใน transaction ไม่ใช่การอ่านแบบหลวม ๆ ก่อนหน้า
    expect(transactionMock).toHaveBeenCalledTimes(1)
  })

  it('เปลี่ยนบทบาท user → admin ได้เมื่อยังเหลือแอดมินใช้งานได้', async () => {
    orderByMock.mockResolvedValue([A1, U1])

    const result = await changeUserRole('u1', 'admin')

    expect(result).toEqual({ ok: true })
    expect(setMock).toHaveBeenCalledWith({ role: 'admin' })
    expect(whereMock).toHaveBeenCalled()
  })

  it('ถือ advisory lock ก่อนเขียนเสมอ (serialize การแก้ไขผู้ใช้)', async () => {
    orderByMock.mockResolvedValue([A1, U1])

    await changeUserRole('u1', 'admin')

    expect(executeMock).toHaveBeenCalledTimes(1)
    expect(executeMock.mock.invocationCallOrder[0]).toBeLessThan(
      setMock.mock.invocationCallOrder[0]!,
    )
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
    executeMock.mockResolvedValue(undefined)
  })

  it('อ่านสถานะและกัน lock-out ภายในทรานแซกชันเดียวกัน', async () => {
    orderByMock.mockResolvedValue([A1, U1])

    await setUserBlocked('a1', 'a1', true)

    expect(transactionMock).toHaveBeenCalledTimes(1)
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
