import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { requireAdminMock, listRoomTypesMock, listDeletedRoomTypesMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  listRoomTypesMock: vi.fn(),
  listDeletedRoomTypesMock: vi.fn(),
}))

vi.mock('@/lib/auth/guards', () => ({ requireAdmin: requireAdminMock }))
vi.mock('@/lib/admin/room-types', () => ({
  listRoomTypes: listRoomTypesMock,
  listDeletedRoomTypes: listDeletedRoomTypesMock,
  isBookingMode: (value: unknown) => value === 'CAPACITY' || value === 'EXCLUSIVE',
  createRoomType: vi.fn(),
  updateRoomType: vi.fn(),
  softDeleteRoomType: vi.fn(),
  restoreRoomType: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { ADMIN, buttonLabels, makeRoomType } from '@/lib/admin/test-fixtures'

import RoomTypePage from './page'

const S = makeRoomType({
  id: 'rt-s',
  code: 'S',
  typeName: 'ห้องทั่วไป',
  bookingMode: 'CAPACITY',
  minDurationMinutes: 60,
})
const G = makeRoomType({
  id: 'rt-g',
  code: 'G',
  typeName: 'ห้องประชุมใหญ่',
  bookingMode: 'EXCLUSIVE',
  minDurationMinutes: 30,
})
const OLD = makeRoomType({
  id: 'rt-p',
  code: 'P',
  typeName: 'ห้องละหมาด',
  bookingMode: 'EXCLUSIVE',
  minDurationMinutes: 15,
  deletedAt: new Date('2026-03-01T03:00:00Z'),
  deletedBy: 'a1',
})

describe('room type page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminMock.mockResolvedValue(ADMIN)
    listRoomTypesMock.mockResolvedValue([S, G])
    listDeletedRoomTypesMock.mockResolvedValue([OLD])
  })

  it('ตรวจสิทธิ์แอดมินก่อนแสดงผล', async () => {
    await RoomTypePage()

    expect(requireAdminMock).toHaveBeenCalledTimes(1)
  })

  it('แสดงรหัส ชื่อ โหมดการจอง และระยะเวลาขั้นต่ำของประเภทที่ใช้งานอยู่', async () => {
    const html = renderToStaticMarkup(await RoomTypePage())

    expect(html).toContain('ห้องประชุมใหญ่')
    expect(html).toContain('จองทับได้ตามความจุ')
    expect(html).toContain('ห้ามจองทับ')
    expect(html).toContain('60 นาที')
    expect(html).toContain('30 นาที')
  })

  it('มีฟอร์มเพิ่มประเภทห้องพร้อมช่องรหัสและชื่อ', async () => {
    const html = renderToStaticMarkup(await RoomTypePage())

    expect(html).toContain('เพิ่มประเภทห้อง')
    expect(html).toContain('name="code"')
    expect(html).toContain('name="typeName"')
  })

  it('มีปุ่มแก้ไขและลบสำหรับแต่ละประเภท', async () => {
    const html = renderToStaticMarkup(await RoomTypePage())
    const labels = buttonLabels(html)

    expect(labels).toContain('แก้ไข')
    expect(labels).toContain('ลบ')
  })

  it('แสดงแผงรายการที่ถูกลบพร้อมปุ่มกู้คืน', async () => {
    const html = renderToStaticMarkup(await RoomTypePage())

    expect(html).toContain('รายการที่ถูกลบ')
    expect(html).toContain('ห้องละหมาด')
    expect(buttonLabels(html)).toContain('กู้คืน')
  })

  it('แจ้งเมื่อยังไม่มีประเภทห้องที่ใช้งานอยู่', async () => {
    listRoomTypesMock.mockResolvedValue([])

    const html = renderToStaticMarkup(await RoomTypePage())

    expect(html).toContain('ยังไม่มีประเภทห้อง')
  })

  it('แจ้งเมื่อยังไม่มีรายการที่ถูกลบ', async () => {
    listDeletedRoomTypesMock.mockResolvedValue([])

    const html = renderToStaticMarkup(await RoomTypePage())

    expect(html).toContain('ยังไม่มีรายการที่ถูกลบ')
  })
})
