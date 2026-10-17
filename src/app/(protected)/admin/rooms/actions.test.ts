import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  requireAdminMock,
  createRoomMock,
  updateRoomMock,
  softDeleteRoomMock,
  restoreRoomMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  createRoomMock: vi.fn(),
  updateRoomMock: vi.fn(),
  softDeleteRoomMock: vi.fn(),
  restoreRoomMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}))

vi.mock('@/lib/auth/guards', () => ({ requireAdmin: requireAdminMock }))
vi.mock('@/lib/admin/rooms', () => ({
  createRoom: createRoomMock,
  updateRoom: updateRoomMock,
  softDeleteRoom: softDeleteRoomMock,
  restoreRoom: restoreRoomMock,
}))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))

import { ADMIN } from '@/lib/admin/test-fixtures'

import { createRoom, deleteRoom, restoreRoom, updateRoom } from './actions'

function form(entries: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value)
  }
  return data
}

const VALID_FORM = {
  name: 'S-101',
  roomTypeId: 'rt-s',
  maxCapacity: '4',
  facilities: 'โปรเจกเตอร์',
}

beforeEach(() => {
  vi.clearAllMocks()
  requireAdminMock.mockResolvedValue(ADMIN)
  createRoomMock.mockResolvedValue({ ok: true, restored: false })
  updateRoomMock.mockResolvedValue({ ok: true })
  softDeleteRoomMock.mockResolvedValue({ ok: true })
  restoreRoomMock.mockResolvedValue({ ok: true })
})

describe('createRoom action', () => {
  it('ตรวจสิทธิ์แอดมินก่อนทุกครั้ง', async () => {
    await createRoom(null, form(VALID_FORM))

    expect(requireAdminMock).toHaveBeenCalledTimes(1)
  })

  it('ส่งอินพุตให้ชั้นข้อมูล แล้วรีเฟรชหน้ารายชื่อห้อง', async () => {
    const result = await createRoom(null, form(VALID_FORM))

    expect(createRoomMock).toHaveBeenCalledWith({
      name: 'S-101',
      roomTypeId: 'rt-s',
      maxCapacity: 4,
      facilities: 'โปรเจกเตอร์',
    })
    expect(result).toEqual({ ok: true, restored: false })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/rooms')
  })

  it('แปลงช่องว่างเป็น null (ความจุ/สิ่งอำนวยความสะดวกไม่บังคับ)', async () => {
    await createRoom(null, form({ name: 'G-1', roomTypeId: 'rt-g', maxCapacity: '', facilities: '' }))

    expect(createRoomMock).toHaveBeenCalledWith({
      name: 'G-1',
      roomTypeId: 'rt-g',
      maxCapacity: null,
      facilities: null,
    })
  })

  it('ไม่รีเฟรชหน้าเมื่อชั้นข้อมูลปฏิเสธ', async () => {
    createRoomMock.mockResolvedValue({ ok: false, message: 'ชื่อซ้ำ' })

    const result = await createRoom(null, form(VALID_FORM))

    expect(result).toEqual({ ok: false, message: 'ชื่อซ้ำ' })
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})

describe('updateRoom action', () => {
  it('ส่ง id และอินพุตให้ชั้นข้อมูล', async () => {
    const result = await updateRoom(null, form({ ...VALID_FORM, id: 'r-101' }))

    expect(updateRoomMock).toHaveBeenCalledWith('r-101', {
      name: 'S-101',
      roomTypeId: 'rt-s',
      maxCapacity: 4,
      facilities: 'โปรเจกเตอร์',
    })
    expect(result).toEqual({ ok: true })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/rooms')
  })

  it('ปฏิเสธเมื่อไม่มี id', async () => {
    const result = await updateRoom(null, form(VALID_FORM))

    expect(result).toMatchObject({ ok: false })
    expect(updateRoomMock).not.toHaveBeenCalled()
  })
})

describe('deleteRoom action', () => {
  it('ลบด้วย id ของแอดมินผู้ดำเนินการ', async () => {
    const result = await deleteRoom(null, form({ id: 'r-101' }))

    expect(softDeleteRoomMock).toHaveBeenCalledWith('r-101', 'a1')
    expect(result).toEqual({ ok: true })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/rooms')
  })
})

describe('restoreRoom action', () => {
  it('กู้คืนตาม id แล้วรีเฟรชหน้า', async () => {
    const result = await restoreRoom(null, form({ id: 'r-old' }))

    expect(restoreRoomMock).toHaveBeenCalledWith('r-old')
    expect(result).toEqual({ ok: true })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/rooms')
  })

  it('ปฏิเสธเมื่อไม่มี id', async () => {
    const result = await restoreRoom(null, form({}))

    expect(result).toMatchObject({ ok: false })
    expect(restoreRoomMock).not.toHaveBeenCalled()
  })
})
