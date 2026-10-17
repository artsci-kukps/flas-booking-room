import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  requireAdminMock,
  createRoomTypeMock,
  updateRoomTypeMock,
  softDeleteRoomTypeMock,
  restoreRoomTypeMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  createRoomTypeMock: vi.fn(),
  updateRoomTypeMock: vi.fn(),
  softDeleteRoomTypeMock: vi.fn(),
  restoreRoomTypeMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}))

vi.mock('@/lib/auth/guards', () => ({ requireAdmin: requireAdminMock }))
vi.mock('@/lib/admin/room-types', () => ({
  isBookingMode: (value: unknown) => value === 'CAPACITY' || value === 'EXCLUSIVE',
  createRoomType: createRoomTypeMock,
  updateRoomType: updateRoomTypeMock,
  softDeleteRoomType: softDeleteRoomTypeMock,
  restoreRoomType: restoreRoomTypeMock,
}))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))

import { ADMIN } from '@/lib/admin/test-fixtures'

import { createRoomType, deleteRoomType, restoreRoomType, updateRoomType } from './actions'

function form(entries: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value)
  }
  return data
}

const VALID_FORM = {
  code: 's',
  typeName: 'ห้องทั่วไป',
  bookingMode: 'CAPACITY',
  minDurationMinutes: '60',
}

beforeEach(() => {
  vi.clearAllMocks()
  requireAdminMock.mockResolvedValue(ADMIN)
  createRoomTypeMock.mockResolvedValue({ ok: true, restored: false })
  updateRoomTypeMock.mockResolvedValue({ ok: true })
  softDeleteRoomTypeMock.mockResolvedValue({ ok: true })
  restoreRoomTypeMock.mockResolvedValue({ ok: true })
})

describe('createRoomType action', () => {
  it('ตรวจสิทธิ์แอดมินก่อนทุกครั้ง', async () => {
    await createRoomType(null, form(VALID_FORM))

    expect(requireAdminMock).toHaveBeenCalledTimes(1)
  })

  it('ส่งอินพุตที่ปรับรูปแล้ว (รหัสพิมพ์ใหญ่) ให้ชั้นข้อมูล แล้วรีเฟรชหน้า', async () => {
    const result = await createRoomType(null, form(VALID_FORM))

    expect(createRoomTypeMock).toHaveBeenCalledWith({
      code: 'S',
      typeName: 'ห้องทั่วไป',
      bookingMode: 'CAPACITY',
      minDurationMinutes: 60,
    })
    expect(result).toEqual({ ok: true, restored: false })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/room/type')
  })

  it('ปฏิเสธโหมดการจองที่ไม่รู้จักโดยไม่แตะชั้นข้อมูล', async () => {
    const result = await createRoomType(null, form({ ...VALID_FORM, bookingMode: 'SHARED' }))

    expect(result).toMatchObject({ ok: false })
    expect(createRoomTypeMock).not.toHaveBeenCalled()
  })

  it('ไม่รีเฟรชหน้าเมื่อชั้นข้อมูลปฏิเสธ', async () => {
    createRoomTypeMock.mockResolvedValue({ ok: false, message: 'รหัสซ้ำ' })

    const result = await createRoomType(null, form(VALID_FORM))

    expect(result).toEqual({ ok: false, message: 'รหัสซ้ำ' })
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})

describe('updateRoomType action', () => {
  it('ส่ง id และอินพุตให้ชั้นข้อมูล', async () => {
    const result = await updateRoomType(null, form({ ...VALID_FORM, id: 'rt-s' }))

    expect(updateRoomTypeMock).toHaveBeenCalledWith('rt-s', {
      code: 'S',
      typeName: 'ห้องทั่วไป',
      bookingMode: 'CAPACITY',
      minDurationMinutes: 60,
    })
    expect(result).toEqual({ ok: true })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/room/type')
  })

  it('ปฏิเสธเมื่อไม่มี id', async () => {
    const result = await updateRoomType(null, form(VALID_FORM))

    expect(result).toMatchObject({ ok: false })
    expect(updateRoomTypeMock).not.toHaveBeenCalled()
  })
})

describe('deleteRoomType action', () => {
  it('ลบด้วย id ของแอดมินผู้ดำเนินการ', async () => {
    const result = await deleteRoomType(null, form({ id: 'rt-s' }))

    expect(softDeleteRoomTypeMock).toHaveBeenCalledWith('rt-s', 'a1')
    expect(result).toEqual({ ok: true })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/room/type')
  })

  it('คืนข้อความจาก trigger และไม่รีเฟรชเมื่อลบไม่ได้', async () => {
    softDeleteRoomTypeMock.mockResolvedValue({ ok: false, message: 'ยังมีห้องอยู่' })

    const result = await deleteRoomType(null, form({ id: 'rt-s' }))

    expect(result).toEqual({ ok: false, message: 'ยังมีห้องอยู่' })
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})

describe('restoreRoomType action', () => {
  it('กู้คืนตาม id แล้วรีเฟรชหน้า', async () => {
    const result = await restoreRoomType(null, form({ id: 'rt-old' }))

    expect(restoreRoomTypeMock).toHaveBeenCalledWith('rt-old')
    expect(result).toEqual({ ok: true })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/room/type')
  })

  it('ปฏิเสธเมื่อไม่มี id', async () => {
    const result = await restoreRoomType(null, form({}))

    expect(result).toMatchObject({ ok: false })
    expect(restoreRoomTypeMock).not.toHaveBeenCalled()
  })
})
