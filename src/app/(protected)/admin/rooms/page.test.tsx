import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { requireAdminMock, listRoomsMock, listDeletedRoomsMock, listRoomTypesMock } = vi.hoisted(
  () => ({
    requireAdminMock: vi.fn(),
    listRoomsMock: vi.fn(),
    listDeletedRoomsMock: vi.fn(),
    listRoomTypesMock: vi.fn(),
  }),
)

vi.mock('@/lib/auth/guards', () => ({ requireAdmin: requireAdminMock }))
vi.mock('@/lib/admin/rooms', () => ({
  listRooms: listRoomsMock,
  listDeletedRooms: listDeletedRoomsMock,
  createRoom: vi.fn(),
  updateRoom: vi.fn(),
  softDeleteRoom: vi.fn(),
  restoreRoom: vi.fn(),
}))
vi.mock('@/lib/admin/room-types', () => ({
  listRoomTypes: listRoomTypesMock,
  isBookingMode: (value: unknown) => value === 'CAPACITY' || value === 'EXCLUSIVE',
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { ADMIN, buttonLabels, makeRoom, makeRoomType } from '@/lib/admin/test-fixtures'

import RoomsPage from './page'

const S = makeRoomType({ id: 'rt-s', code: 'S', typeName: 'ห้องทั่วไป', bookingMode: 'CAPACITY' })
const G = makeRoomType({
  id: 'rt-g',
  code: 'G',
  typeName: 'ห้องประชุมใหญ่',
  bookingMode: 'EXCLUSIVE',
  minDurationMinutes: 30,
})

const R1 = makeRoom({
  id: 'r1',
  name: 'S-101',
  roomTypeId: 'rt-s',
  roomTypeCode: 'S',
  roomTypeName: 'ห้องทั่วไป',
  bookingMode: 'CAPACITY',
  maxCapacity: 4,
  facilities: 'ไวท์บอร์ด',
})
const R2 = makeRoom({
  id: 'r2',
  name: 'G-1',
  roomTypeId: 'rt-g',
  roomTypeCode: 'G',
  roomTypeName: 'ห้องประชุมใหญ่',
  bookingMode: 'EXCLUSIVE',
  maxCapacity: null,
  facilities: null,
})
const OLD = makeRoom({
  id: 'r0',
  name: 'P-9',
  roomTypeId: 'rt-p',
  roomTypeCode: 'P',
  roomTypeName: 'ห้องละหมาด',
  bookingMode: 'EXCLUSIVE',
  maxCapacity: null,
  facilities: null,
  deletedAt: new Date('2026-03-01T03:00:00Z'),
  deletedBy: 'a1',
})

describe('rooms page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminMock.mockResolvedValue(ADMIN)
    listRoomsMock.mockResolvedValue([R1, R2])
    listDeletedRoomsMock.mockResolvedValue([OLD])
    listRoomTypesMock.mockResolvedValue([S, G])
  })

  it('ตรวจสิทธิ์แอดมินก่อนแสดงผล', async () => {
    await RoomsPage()

    expect(requireAdminMock).toHaveBeenCalledTimes(1)
  })

  it('แสดงชื่อ ความจุ และสิ่งอำนวยความสะดวกของห้อง', async () => {
    const html = renderToStaticMarkup(await RoomsPage())

    expect(html).toContain('G-1')
    expect(html).toContain('4 คน')
    expect(html).toContain('ไวท์บอร์ด')
    expect(html).toContain('ไม่ระบุ')
  })

  it('มีฟอร์มเพิ่มห้องพร้อมช่องชื่อ ประเภท และความจุ', async () => {
    const html = renderToStaticMarkup(await RoomsPage())

    expect(html).toContain('เพิ่มห้อง')
    expect(html).toContain('name="name"')
    expect(html).toContain('name="roomTypeId"')
    expect(html).toContain('name="maxCapacity"')
  })

  it('มีปุ่มแก้ไขและลบสำหรับแต่ละห้อง', async () => {
    const labels = buttonLabels(renderToStaticMarkup(await RoomsPage()))

    expect(labels).toContain('แก้ไข')
    expect(labels).toContain('ลบ')
  })

  it('แสดงแผงรายการที่ถูกลบพร้อมปุ่มกู้คืน', async () => {
    const html = renderToStaticMarkup(await RoomsPage())

    expect(html).toContain('รายการที่ถูกลบ')
    expect(html).toContain('P-9')
    expect(buttonLabels(html)).toContain('กู้คืน')
  })

  it('เตือนเมื่อยังไม่มีประเภทห้องที่ใช้งานอยู่', async () => {
    listRoomTypesMock.mockResolvedValue([])

    const html = renderToStaticMarkup(await RoomsPage())

    expect(html).toContain('ยังไม่มีประเภทห้องที่ใช้งานอยู่')
  })

  it('แจ้งเมื่อยังไม่มีห้องในระบบ', async () => {
    listRoomsMock.mockResolvedValue([])

    const html = renderToStaticMarkup(await RoomsPage())

    expect(html).toContain('ยังไม่มีห้องในระบบ')
  })
})
