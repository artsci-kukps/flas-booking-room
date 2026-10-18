import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { requireAdminMock, listBookingsForDayMock, findBookingByCodeOnDayMock } =
  vi.hoisted(() => ({
    requireAdminMock: vi.fn(),
    listBookingsForDayMock: vi.fn(),
    findBookingByCodeOnDayMock: vi.fn(),
  }))

vi.mock('@/lib/auth/guards', () => ({ requireAdmin: requireAdminMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/admin/booking-admin', () => ({
  listBookingsForDay: listBookingsForDayMock,
  findBookingByCodeOnDay: findBookingByCodeOnDayMock,
  isBookingCode: (value: string) => /^\d{6}$/.test(value),
}))

import { ADMIN, buttonLabels } from '@/lib/admin/test-fixtures'
import type { AdminBookingRow } from '@/lib/admin/booking-admin'

import BookingManagementPage from './page'

const DATE = '2026-10-19'

function bookingRow(overrides: Partial<AdminBookingRow> = {}): AdminBookingRow {
  return {
    id: 'r-1',
    bookingCode: '123456',
    bookerName: 'สมชาย ใจดี',
    bookerEmail: 'somchai@ku.th',
    roomName: 'S-101',
    roomTypeCode: 'S',
    startTime: new Date('2026-10-19T02:30:00Z'),
    endTime: new Date('2026-10-19T03:30:00Z'),
    status: 'PENDING',
    ...overrides,
  }
}

function render(params: Record<string, string> = {}): Promise<string> {
  return BookingManagementPage({
    searchParams: Promise.resolve({ date: DATE, ...params }),
  }).then(renderToStaticMarkup)
}

beforeEach(() => {
  vi.clearAllMocks()
  requireAdminMock.mockResolvedValue(ADMIN)
  listBookingsForDayMock.mockResolvedValue([bookingRow()])
  findBookingByCodeOnDayMock.mockResolvedValue(null)
})

describe('admin booking-management page', () => {
  it('ตรวจสิทธิ์แอดมินก่อนแสดงผล', async () => {
    await render()

    expect(requireAdminMock).toHaveBeenCalledTimes(1)
  })

  it('แสดงตารางการจองตามวันและห้อง พร้อมผู้จอง ช่วงเวลา และสถานะ', async () => {
    const html = await render()

    expect(html).toContain('123456')
    expect(html).toContain('สมชาย ใจดี')
    expect(html).toContain('somchai@ku.th')
    expect(html).toContain('S-101')
    expect(html).toContain('รอรับกุญแจ')
  })

  it('มีปุ่มยืนยันรับกุญแจสำหรับรายการ PENDING', async () => {
    const labels = buttonLabels(await render())

    expect(labels).toContain('ยืนยันรับกุญแจ')
  })

  it('มีปุ่มยืนยันคืนกุญแจสำหรับรายการ ACTIVE', async () => {
    listBookingsForDayMock.mockResolvedValue([bookingRow({ status: 'ACTIVE' })])

    const labels = buttonLabels(await render())

    expect(labels).toContain('ยืนยันคืนกุญแจ')
  })

  it('แจ้งเมื่อวันนั้นไม่มีการจอง', async () => {
    listBookingsForDayMock.mockResolvedValue([])

    const html = await render()

    expect(html).toContain('ไม่มีการจองในวันนี้')
  })

  it('ค้นรหัสที่มีจริงของวันนี้ → แสดงผลการค้นพร้อมปุ่มรับ–คืนกุญแจ', async () => {
    findBookingByCodeOnDayMock.mockResolvedValue(bookingRow())

    const html = await render({ code: '123456' })

    expect(html).toContain('123456')
    expect(buttonLabels(html)).toContain('ยืนยันรับกุญแจ')
  })

  it('ค้นรหัสที่ไม่พบในวันนี้ → แจ้งว่าไม่พบ (จำกัดขอบเขตวันนี้)', async () => {
    findBookingByCodeOnDayMock.mockResolvedValue(null)

    const html = await render({ code: '999999' })

    expect(html).toContain('ไม่พบรหัส 999999 ในวันนี้')
  })

  it('ค้นรหัสที่รูปแบบผิด → แจ้งข้อกำหนด 6 หลัก โดยไม่ค้นฐานข้อมูล', async () => {
    const html = await render({ code: 'abc' })

    expect(html).toContain('รหัสการจองต้องเป็นตัวเลข 6 หลัก')
    expect(findBookingByCodeOnDayMock).not.toHaveBeenCalled()
  })

  it('ค้นด้วยขอบเขตวันนี้เสมอ ไม่ใช่วันที่กำลังดูตาราง', async () => {
    findBookingByCodeOnDayMock.mockResolvedValue(null)
    // วันนี้ในเขตไทย — แหล่งความจริงอิสระจากตัวโค้ด
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' })
    const browsedDay = '2020-01-01' // วันของตารางคนละวันกับวันนี้

    await render({ date: browsedDay, code: '123456' })

    expect(findBookingByCodeOnDayMock).toHaveBeenCalledWith('123456', today)
  })
})
