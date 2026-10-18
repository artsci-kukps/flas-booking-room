import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  requireAdminMock,
  createHolidayMock,
  deleteHolidayMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  createHolidayMock: vi.fn(),
  deleteHolidayMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}))

vi.mock('@/lib/auth/guards', () => ({ requireAdmin: requireAdminMock }))
vi.mock('@/lib/admin/holidays', () => ({
  createHoliday: createHolidayMock,
  deleteHoliday: deleteHolidayMock,
}))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))

import { ADMIN } from '@/lib/admin/test-fixtures'

import { createHoliday, deleteHoliday } from './actions'

function form(entries: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value)
  }
  return data
}

const VALID_FORM = {
  holidayDate: '2026-04-06',
  name: 'วันจักรี',
  note: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  requireAdminMock.mockResolvedValue(ADMIN)
  createHolidayMock.mockResolvedValue({ ok: true })
  deleteHolidayMock.mockResolvedValue({ ok: true })
})

describe('createHoliday action', () => {
  it('ตรวจสิทธิ์แอดมินก่อนทุกครั้ง', async () => {
    await createHoliday(null, form(VALID_FORM))

    expect(requireAdminMock).toHaveBeenCalledTimes(1)
  })

  it('ส่งอินพุตให้ชั้นข้อมูลพร้อมตัวแอดมิน แล้วรีเฟรชหน้า', async () => {
    const result = await createHoliday(null, form(VALID_FORM))

    expect(createHolidayMock).toHaveBeenCalledWith(
      { holidayDate: '2026-04-06', name: 'วันจักรี', note: null },
      'a1',
    )
    expect(result).toEqual({ ok: true })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/holidays')
  })

  it('ส่งหมายเหตุเมื่อกรอกไว้', async () => {
    await createHoliday(null, form({ ...VALID_FORM, note: 'ชดเชยวันเสาร์' }))

    expect(createHolidayMock).toHaveBeenCalledWith(
      expect.objectContaining({ note: 'ชดเชยวันเสาร์' }),
      'a1',
    )
  })

  it('ไม่รีเฟรชหน้าเมื่อชั้นข้อมูลปฏิเสธ (วันที่ซ้ำ)', async () => {
    createHolidayMock.mockResolvedValue({ ok: false, message: 'วันที่ซ้ำ' })

    const result = await createHoliday(null, form(VALID_FORM))

    expect(result).toEqual({ ok: false, message: 'วันที่ซ้ำ' })
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})

describe('deleteHoliday action', () => {
  it('ลบด้วย id แล้วรีเฟรชหน้า', async () => {
    const result = await deleteHoliday(null, form({ id: 'h-1' }))

    expect(deleteHolidayMock).toHaveBeenCalledWith('h-1')
    expect(result).toEqual({ ok: true })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/holidays')
  })

  it('ปฏิเสธเมื่อไม่มี id', async () => {
    const result = await deleteHoliday(null, form({}))

    expect(result).toMatchObject({ ok: false })
    expect(deleteHolidayMock).not.toHaveBeenCalled()
  })
})
