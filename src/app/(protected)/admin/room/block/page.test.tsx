import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const {
  requireAdminMock,
  listRoomBlocksMock,
  listRoomsMock,
  createRoomBlockMock,
  deleteRoomBlockMock,
} = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  listRoomBlocksMock: vi.fn(),
  listRoomsMock: vi.fn(),
  createRoomBlockMock: vi.fn(),
  deleteRoomBlockMock: vi.fn(),
}))

vi.mock('@/lib/auth/guards', () => ({ requireAdmin: requireAdminMock }))
vi.mock('@/lib/admin/room-blocks', () => ({
  listRoomBlocks: listRoomBlocksMock,
  createRoomBlock: createRoomBlockMock,
  deleteRoomBlock: deleteRoomBlockMock,
  parseBangkokDateTimeLocal: (value: string) => {
    const date = new Date(`${value}:00+07:00`)
    return Number.isNaN(date.getTime()) ? null : date
  },
}))
vi.mock('@/lib/admin/rooms', () => ({
  listRooms: listRoomsMock,
  listDeletedRooms: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { ADMIN, buttonLabels, makeRoom } from '@/lib/admin/test-fixtures'

import RoomBlockPage from './page'

const BLOCK = {
  id: 'rb-1',
  roomId: 'r-1',
  roomName: 'S-101',
  startTime: new Date('2026-03-01T02:00:00Z'),
  endTime: new Date('2026-03-01T05:00:00Z'),
  reason: 'ปิดปรับปรุงแอร์',
  createdBy: 'a1',
  createdByName: 'ผู้ดูแล ระบบ',
  createdByEmail: 'admin@ku.th',
  createdAt: new Date('2026-02-20T03:00:00Z'),
}

describe('room block page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminMock.mockResolvedValue(ADMIN)
    listRoomBlocksMock.mockResolvedValue([BLOCK])
    listRoomsMock.mockResolvedValue([
      makeRoom({ id: 'r-1', name: 'S-101' }),
      makeRoom({ id: 'r-2', name: 'S-102' }),
    ])
  })

  it('ตรวจสิทธิ์แอดมินก่อนแสดงผล', async () => {
    await RoomBlockPage()

    expect(requireAdminMock).toHaveBeenCalledTimes(1)
  })

  it('แสดงห้อง เวลา เหตุผล และผู้สร้างของแต่ละรายการ', async () => {
    const html = renderToStaticMarkup(await RoomBlockPage())

    expect(html).toContain('S-101')
    expect(html).toContain('09:00')
    expect(html).toContain('12:00')
    expect(html).toContain('ปิดปรับปรุงแอร์')
    expect(html).toContain('ผู้ดูแล ระบบ')
  })

  it('ใช้อีเมลแทนชื่อเมื่อผู้สร้างไม่มีชื่อเต็ม', async () => {
    listRoomBlocksMock.mockResolvedValue([{ ...BLOCK, createdByName: null }])

    const html = renderToStaticMarkup(await RoomBlockPage())

    expect(html).toContain('admin@ku.th')
  })

  it('มีฟอร์มเพิ่มบล็อกพร้อมช่องห้อง เวลา เหตุผล และรายชื่อห้องที่เลือกได้', async () => {
    const html = renderToStaticMarkup(await RoomBlockPage())

    expect(html).toContain('name="roomId"')
    expect(html).toContain('name="startTime"')
    expect(html).toContain('name="endTime"')
    expect(html).toContain('name="reason"')
    expect(html).toContain('S-102')
  })

  it('มีปุ่มลบสำหรับแต่ละรายการ', async () => {
    const html = renderToStaticMarkup(await RoomBlockPage())

    expect(buttonLabels(html)).toContain('ลบ')
  })

  it('แจ้งเมื่อยังไม่มีการบล็อกห้อง', async () => {
    listRoomBlocksMock.mockResolvedValue([])

    const html = renderToStaticMarkup(await RoomBlockPage())

    expect(html).toContain('ยังไม่มีการบล็อกห้อง')
  })
})
