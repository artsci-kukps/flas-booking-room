import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  requireAdminMock,
  confirmKeyPickupMock,
  confirmKeyReturnMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  confirmKeyPickupMock: vi.fn(),
  confirmKeyReturnMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}))

vi.mock('@/lib/auth/guards', () => ({ requireAdmin: requireAdminMock }))
vi.mock('@/lib/admin/booking-admin', () => ({
  confirmKeyPickup: confirmKeyPickupMock,
  confirmKeyReturn: confirmKeyReturnMock,
}))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))

import { ADMIN } from '@/lib/admin/test-fixtures'

import { confirmKeyPickupAction, confirmKeyReturnAction } from './key-actions'

function form(entries: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value)
  }
  return data
}

beforeEach(() => {
  vi.clearAllMocks()
  requireAdminMock.mockResolvedValue(ADMIN)
  confirmKeyPickupMock.mockResolvedValue({ ok: true, status: 'ACTIVE' })
  confirmKeyReturnMock.mockResolvedValue({ ok: true, status: 'COMPLETED' })
})

describe('confirmKeyPickupAction', () => {
  it('ตรวจสิทธิ์แอดมินก่อนทุกครั้ง', async () => {
    await confirmKeyPickupAction(null, form({ id: 'r-1' }))

    expect(requireAdminMock).toHaveBeenCalledTimes(1)
  })

  it('ส่ง id และผู้ยืนยันให้ชั้นข้อมูล แล้วรีเฟรชหน้าเมื่อสำเร็จ', async () => {
    const result = await confirmKeyPickupAction(null, form({ id: 'r-1' }))

    expect(confirmKeyPickupMock).toHaveBeenCalledWith('r-1', 'a1')
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/booking-management')
    expect(result).toEqual({ ok: true, status: 'ACTIVE' })
  })

  it('ไม่รีเฟรชหน้าเมื่อไม่สำเร็จ', async () => {
    confirmKeyPickupMock.mockResolvedValue({ ok: false, message: 'รับซ้ำไม่ได้' })

    await confirmKeyPickupAction(null, form({ id: 'r-1' }))

    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('ปฏิเสธเมื่อไม่มี id โดยไม่แตะชั้นข้อมูล', async () => {
    const result = await confirmKeyPickupAction(null, form({}))

    expect(result.ok).toBe(false)
    expect(confirmKeyPickupMock).not.toHaveBeenCalled()
  })
})

describe('confirmKeyReturnAction', () => {
  it('ส่ง id และผู้ยืนยันให้ชั้นข้อมูล แล้วรีเฟรชหน้าเมื่อสำเร็จ', async () => {
    const result = await confirmKeyReturnAction(null, form({ id: 'r-1' }))

    expect(confirmKeyReturnMock).toHaveBeenCalledWith('r-1', 'a1')
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/booking-management')
    expect(result).toEqual({ ok: true, status: 'COMPLETED' })
  })

  it('ไม่รีเฟรชหน้าเมื่อไม่สำเร็จ', async () => {
    confirmKeyReturnMock.mockResolvedValue({ ok: false, message: 'คืนซ้ำไม่ได้' })

    await confirmKeyReturnAction(null, form({ id: 'r-1' }))

    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('ปฏิเสธเมื่อไม่มี id โดยไม่แตะชั้นข้อมูล', async () => {
    const result = await confirmKeyReturnAction(null, form({}))

    expect(result.ok).toBe(false)
    expect(confirmKeyReturnMock).not.toHaveBeenCalled()
  })
})
