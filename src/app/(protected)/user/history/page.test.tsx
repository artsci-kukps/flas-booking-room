import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { requireUserMock, listMyBookingsMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  listMyBookingsMock: vi.fn(),
}))

vi.mock('@/lib/auth/guards', () => ({ requireUser: requireUserMock }))
vi.mock('@/lib/booking/my-bookings', () => ({ listMyBookings: listMyBookingsMock }))
vi.mock('./actions', () => ({ cancelBooking: vi.fn() }))

import HistoryPage from './page'

/** ข้อความต้องคืนกุญแจก่อน (สัญญาของ ticket #10 — ตรวจแบบ literal เพื่อไม่ผูกกับ implementation) */
const KEY_RETURN_MESSAGE = 'การจองนี้กำลังใช้งานอยู่ ยกเลิกไม่ได้ — ต้องคืนกุญแจก่อน'

const USER = {
  id: 'u1',
  email: 'somchai@ku.th',
  fullName: 'สมชาย ใจดี',
  imageUrl: null,
  role: 'user',
  isBlocked: false,
}

/** แถวการจองตัวอย่าง — 09:30–10:30 Bangkok ของวันที่ 19 ต.ค. 2026 */
function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'res-1',
    bookingCode: '123456',
    status: 'PENDING',
    roomName: 'S-101',
    roomTypeCode: 'S',
    bookingDate: '2026-10-19',
    startTime: new Date('2026-10-19T02:30:00Z'),
    endTime: new Date('2026-10-19T03:30:00Z'),
    canceledAt: null,
    canCancel: true,
    cancelBlockedMessage: null,
    ...overrides,
  }
}

describe('หน้าการจองของฉัน (/user/history)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireUserMock.mockResolvedValue(USER)
    listMyBookingsMock.mockResolvedValue([booking()])
  })

  it('ตรวจสิทธิ์ผู้ใช้ และดึงประวัติเฉพาะของผู้ใช้คนนี้', async () => {
    await HistoryPage()

    expect(requireUserMock).toHaveBeenCalledTimes(1)
    expect(listMyBookingsMock).toHaveBeenCalledWith('u1')
  })

  it('แสดงห้อง ช่วงเวลา รหัสการจอง และสถานะของแต่ละรายการ', async () => {
    const html = renderToStaticMarkup(await HistoryPage())

    expect(html).toContain('S-101')
    expect(html).toContain('123456')
    expect(html).toContain('09:30')
    expect(html).toContain('10:30')
    expect(html).toContain('รอรับกุญแจ')
  })

  it('PENDING ก่อนเวลาเริ่ม: มีปุ่มยกเลิกการจอง', async () => {
    const html = renderToStaticMarkup(await HistoryPage())

    expect(html).toContain('ยกเลิกการจอง')
  })

  it('ACTIVE: ไม่มีปุ่มยกเลิก และแจ้งว่าต้องคืนกุญแจก่อน', async () => {
    listMyBookingsMock.mockResolvedValue([
      booking({ status: 'ACTIVE', canCancel: false, cancelBlockedMessage: KEY_RETURN_MESSAGE }),
    ])

    const html = renderToStaticMarkup(await HistoryPage())

    expect(html).toContain('กำลังใช้งาน')
    expect(html).toContain('ต้องคืนกุญแจก่อน')
    expect(html).not.toContain('ยกเลิกการจอง')
  })

  it('PENDING ที่เลยเวลาเริ่ม: ไม่มีปุ่มยกเลิก', async () => {
    listMyBookingsMock.mockResolvedValue([
      booking({ canCancel: false, cancelBlockedMessage: 'เลยเวลาเริ่มของการจองแล้ว ยกเลิกไม่ได้' }),
    ])

    const html = renderToStaticMarkup(await HistoryPage())

    expect(html).not.toContain('ยกเลิกการจอง')
  })

  it('รายการที่ยกเลิกแล้ว: แสดงสถานะยกเลิกพร้อมเวลาที่ยกเลิก ไม่มีปุ่มยกเลิก', async () => {
    listMyBookingsMock.mockResolvedValue([
      booking({
        status: 'CANCELLED',
        canCancel: false,
        cancelBlockedMessage: 'ยกเลิกได้เฉพาะการจองที่รอรับกุญแจ (PENDING) เท่านั้น',
        canceledAt: new Date('2026-10-18T05:00:00Z'),
      }),
    ])

    const html = renderToStaticMarkup(await HistoryPage())

    expect(html).toContain('ยกเลิกแล้ว')
    expect(html).toContain('ยกเลิกเมื่อ')
    expect(html).not.toContain('ยกเลิกการจอง')
  })

  it('ยังไม่มีการจอง: แจ้งว่ายังไม่มีรายการ', async () => {
    listMyBookingsMock.mockResolvedValue([])

    const html = renderToStaticMarkup(await HistoryPage())

    expect(html).toContain('ยังไม่มีการจอง')
  })
})
