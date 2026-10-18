import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  requireAdminMock,
  createRoomBlockMock,
  deleteRoomBlockMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  createRoomBlockMock: vi.fn(),
  deleteRoomBlockMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}))

vi.mock('@/lib/auth/guards', () => ({ requireAdmin: requireAdminMock }))
vi.mock('@/lib/admin/room-blocks', () => ({
  createRoomBlock: createRoomBlockMock,
  deleteRoomBlock: deleteRoomBlockMock,
  // จำลองตัวแปลงเวลาแบบย่อ — การตรวจรูปแบบจริงอยู่ในระดับโดเมนแล้ว
  parseBangkokDateTimeLocal: (value: string) => {
    const date = new Date(`${value}:00+07:00`)
    return Number.isNaN(date.getTime()) ? null : date
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))

import { ADMIN } from '@/lib/admin/test-fixtures'

import { createRoomBlock, deleteRoomBlock } from './actions'

function form(entries: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value)
  }
  return data
}

const VALID_FORM = {
  roomId: 'r-1',
  startTime: '2026-03-01T09:00',
  endTime: '2026-03-01T12:00',
  reason: 'ปิดปรับปรุงแอร์',
}

beforeEach(() => {
  vi.clearAllMocks()
  requireAdminMock.mockResolvedValue(ADMIN)
  createRoomBlockMock.mockResolvedValue({ ok: true })
  deleteRoomBlockMock.mockResolvedValue({ ok: true })
})

describe('createRoomBlock action', () => {
  it('ตรวจสิทธิ์แอดมินก่อนทุกครั้ง', async () => {
    await createRoomBlock(null, form(VALID_FORM))

    expect(requireAdminMock).toHaveBeenCalledTimes(1)
  })

  it('แปลงเวลาตามเขต Asia/Bangkok แล้วส่งอินพุตให้ชั้นข้อมูล พร้อมผู้สร้างเป็นแอดมิน', async () => {
    const result = await createRoomBlock(null, form(VALID_FORM))

    expect(createRoomBlockMock).toHaveBeenCalledWith(
      {
        roomId: 'r-1',
        startTime: new Date('2026-03-01T02:00:00Z'),
        endTime: new Date('2026-03-01T05:00:00Z'),
        reason: 'ปิดปรับปรุงแอร์',
      },
      'a1',
    )
    expect(result).toEqual({ ok: true })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/room/block')
  })

  it('ปฏิเสธเวลาที่รูปแบบไม่ถูกต้องโดยไม่แตะชั้นข้อมูล', async () => {
    const result = await createRoomBlock(null, form({ ...VALID_FORM, startTime: 'เมื่อวาน' }))

    expect(result).toMatchObject({ ok: false })
    expect(createRoomBlockMock).not.toHaveBeenCalled()
  })

  it('ไม่รีเฟรชหน้าเมื่อชั้นข้อมูลปฏิเสธ', async () => {
    createRoomBlockMock.mockResolvedValue({ ok: false, message: 'ช่วงเวลาทับกัน' })

    const result = await createRoomBlock(null, form(VALID_FORM))

    expect(result).toEqual({ ok: false, message: 'ช่วงเวลาทับกัน' })
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})

describe('deleteRoomBlock action', () => {
  it('ลบรายการตาม id แล้วรีเฟรชหน้า', async () => {
    const result = await deleteRoomBlock(null, form({ id: 'rb-1' }))

    expect(deleteRoomBlockMock).toHaveBeenCalledWith('rb-1')
    expect(result).toEqual({ ok: true })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/room/block')
  })

  it('ปฏิเสธเมื่อไม่มี id', async () => {
    const result = await deleteRoomBlock(null, form({}))

    expect(result).toMatchObject({ ok: false })
    expect(deleteRoomBlockMock).not.toHaveBeenCalled()
  })

  it('ไม่รีเฟรชหน้าเมื่อลบไม่ได้', async () => {
    deleteRoomBlockMock.mockResolvedValue({ ok: false, message: 'ไม่พบรายการ' })

    const result = await deleteRoomBlock(null, form({ id: 'rb-gone' }))

    expect(result).toEqual({ ok: false, message: 'ไม่พบรายการ' })
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})
