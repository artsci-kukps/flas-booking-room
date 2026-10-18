import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  requireAdminMock,
  createServicePeriodMock,
  updateServicePeriodMock,
  deleteServicePeriodMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  createServicePeriodMock: vi.fn(),
  updateServicePeriodMock: vi.fn(),
  deleteServicePeriodMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}))

vi.mock('@/lib/auth/guards', () => ({ requireAdmin: requireAdminMock }))
vi.mock('@/lib/admin/service-periods', () => ({
  isServicePeriodKind: (value: unknown) => value === 'NORMAL' || value === 'EXAM',
  createServicePeriod: createServicePeriodMock,
  updateServicePeriod: updateServicePeriodMock,
  deleteServicePeriod: deleteServicePeriodMock,
}))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))

import { ADMIN } from '@/lib/admin/test-fixtures'

import { createServicePeriod, deleteServicePeriod, updateServicePeriod } from './actions'

function form(entries: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value)
  }
  return data
}

const VALID_FORM = {
  name: 'ช่วงสอบปลายภาค',
  kind: 'EXAM',
  openTime: '08:30',
  closeTime: '20:30',
  effectiveFrom: '2026-05-01',
  effectiveTo: '2026-05-31',
}

beforeEach(() => {
  vi.clearAllMocks()
  requireAdminMock.mockResolvedValue(ADMIN)
  createServicePeriodMock.mockResolvedValue({ ok: true })
  updateServicePeriodMock.mockResolvedValue({ ok: true })
  deleteServicePeriodMock.mockResolvedValue({ ok: true })
})

describe('createServicePeriod action', () => {
  it('ตรวจสิทธิ์แอดมินก่อนทุกครั้ง', async () => {
    await createServicePeriod(null, form(VALID_FORM))

    expect(requireAdminMock).toHaveBeenCalledTimes(1)
  })

  it('ส่งอินพุตให้ชั้นข้อมูลพร้อมตัวแอดมิน แล้วรีเฟรชหน้า', async () => {
    const result = await createServicePeriod(null, form(VALID_FORM))

    expect(createServicePeriodMock).toHaveBeenCalledWith(
      {
        name: 'ช่วงสอบปลายภาค',
        kind: 'EXAM',
        openTime: '08:30',
        closeTime: '20:30',
        effectiveFrom: '2026-05-01',
        effectiveTo: '2026-05-31',
      },
      'a1',
    )
    expect(result).toEqual({ ok: true })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/system-setting')
  })

  it('แปลง effectiveTo ว่างเป็น null (มีผลต่อเนื่อง)', async () => {
    await createServicePeriod(null, form({ ...VALID_FORM, effectiveTo: '' }))

    expect(createServicePeriodMock).toHaveBeenCalledWith(
      expect.objectContaining({ effectiveTo: null }),
      'a1',
    )
  })

  it('ปฏิเสธ kind ที่ไม่รู้จักโดยไม่แตะชั้นข้อมูล', async () => {
    const result = await createServicePeriod(null, form({ ...VALID_FORM, kind: 'HOLIDAY' }))

    expect(result).toMatchObject({ ok: false })
    expect(createServicePeriodMock).not.toHaveBeenCalled()
  })

  it('ไม่รีเฟรชหน้าเมื่อชั้นข้อมูลปฏิเสธ', async () => {
    createServicePeriodMock.mockResolvedValue({ ok: false, message: 'ทับซ้อน' })

    const result = await createServicePeriod(null, form(VALID_FORM))

    expect(result).toEqual({ ok: false, message: 'ทับซ้อน' })
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})

describe('updateServicePeriod action', () => {
  it('ส่ง id และอินพุตให้ชั้นข้อมูล แล้วรีเฟรชหน้า', async () => {
    const result = await updateServicePeriod(null, form({ ...VALID_FORM, id: 'sp-1' }))

    expect(updateServicePeriodMock).toHaveBeenCalledWith('sp-1', {
      name: 'ช่วงสอบปลายภาค',
      kind: 'EXAM',
      openTime: '08:30',
      closeTime: '20:30',
      effectiveFrom: '2026-05-01',
      effectiveTo: '2026-05-31',
    })
    expect(result).toEqual({ ok: true })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/system-setting')
  })

  it('ปฏิเสธเมื่อไม่มี id', async () => {
    const result = await updateServicePeriod(null, form(VALID_FORM))

    expect(result).toMatchObject({ ok: false })
    expect(updateServicePeriodMock).not.toHaveBeenCalled()
  })
})

describe('deleteServicePeriod action', () => {
  it('ลบด้วย id แล้วรีเฟรชหน้า', async () => {
    const result = await deleteServicePeriod(null, form({ id: 'sp-1' }))

    expect(deleteServicePeriodMock).toHaveBeenCalledWith('sp-1')
    expect(result).toEqual({ ok: true })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/system-setting')
  })

  it('ปฏิเสธเมื่อไม่มี id', async () => {
    const result = await deleteServicePeriod(null, form({}))

    expect(result).toMatchObject({ ok: false })
    expect(deleteServicePeriodMock).not.toHaveBeenCalled()
  })
})
