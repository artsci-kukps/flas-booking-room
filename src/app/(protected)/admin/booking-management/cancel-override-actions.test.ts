import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireAdminMock, cancelMock, overrideMock, revalidatePathMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  cancelMock: vi.fn(),
  overrideMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}))

vi.mock('@/lib/auth/guards', () => ({ requireAdmin: requireAdminMock }))
vi.mock('@/lib/admin/booking-admin', () => ({
  cancelReservation: cancelMock,
  overrideReservationStatus: overrideMock,
}))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))

import { ADMIN } from '@/lib/admin/test-fixtures'

import { cancelReservationAction, overrideReservationStatusAction } from './cancel-override-actions'

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
  cancelMock.mockResolvedValue({ ok: true, status: 'CANCELLED' })
  overrideMock.mockResolvedValue({ ok: true, status: 'ACTIVE' })
})

describe('cancelReservationAction', () => {
  it('ตรวจสิทธิ์แอดมินก่อนทุกครั้ง และส่ง id/เหตุผล/ผู้ดำเนินการให้ชั้นข้อมูล', async () => {
    await cancelReservationAction(null, form({ id: 'r-1', reason: '  ผู้ใช้โทรขอยกเลิก  ' }))

    expect(requireAdminMock).toHaveBeenCalledTimes(1)
    expect(cancelMock).toHaveBeenCalledWith('r-1', 'ผู้ใช้โทรขอยกเลิก', 'a1')
  })

  it('ยกเลิกสำเร็จ: รีเฟรชหน้ารายการจอง', async () => {
    const result = await cancelReservationAction(null, form({ id: 'r-1', reason: 'เหตุผล' }))

    expect(result).toEqual({ ok: true, status: 'CANCELLED' })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/booking-management')
  })

  it('ไม่รีเฟรชหน้าเมื่อชั้นข้อมูลปฏิเสธ (เช่น ไม่ระบุเหตุผล)', async () => {
    cancelMock.mockResolvedValue({ ok: false, message: 'กรุณาระบุเหตุผลการดำเนินการ' })

    const result = await cancelReservationAction(null, form({ id: 'r-1', reason: '' }))

    expect(result).toEqual({ ok: false, message: 'กรุณาระบุเหตุผลการดำเนินการ' })
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('ปฏิเสธเมื่อไม่มี id โดยไม่แตะชั้นข้อมูล', async () => {
    const result = await cancelReservationAction(null, form({}))

    expect(result.ok).toBe(false)
    expect(cancelMock).not.toHaveBeenCalled()
  })
})

describe('overrideReservationStatusAction', () => {
  it('ส่ง id/สถานะใหม่/เหตุผล/ผู้ดำเนินการให้ชั้นข้อมูล แล้วรีเฟรชหน้าเมื่อสำเร็จ', async () => {
    const result = await overrideReservationStatusAction(
      null,
      form({ id: 'r-1', status: 'ACTIVE', reason: 'ระบบตั้ง NO_SHOW ผิด' }),
    )

    expect(requireAdminMock).toHaveBeenCalledTimes(1)
    expect(overrideMock).toHaveBeenCalledWith('r-1', 'ACTIVE', 'ระบบตั้ง NO_SHOW ผิด', 'a1')
    expect(result).toEqual({ ok: true, status: 'ACTIVE' })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/booking-management')
  })

  it('ไม่รีเฟรชหน้าเมื่อชั้นข้อมูลปฏิเสธ', async () => {
    overrideMock.mockResolvedValue({ ok: false, message: 'สถานะที่เลือกไม่ถูกต้อง' })

    await overrideReservationStatusAction(
      null,
      form({ id: 'r-1', status: 'BOGUS', reason: 'เหตุผล' }),
    )

    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('ปฏิเสธเมื่อไม่มี id โดยไม่แตะชั้นข้อมูล', async () => {
    const result = await overrideReservationStatusAction(null, form({}))

    expect(result.ok).toBe(false)
    expect(overrideMock).not.toHaveBeenCalled()
  })
})
