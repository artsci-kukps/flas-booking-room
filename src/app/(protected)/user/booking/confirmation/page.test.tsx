import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { requireUserMock, getBookingConfirmationMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  getBookingConfirmationMock: vi.fn(),
}))

vi.mock('@/lib/auth/guards', () => ({ requireUser: requireUserMock }))
vi.mock('@/lib/booking/reservations', () => ({
  getBookingConfirmation: getBookingConfirmationMock,
}))

import BookingConfirmationPage from './page'

async function renderPage(params: Record<string, string | string[] | undefined>) {
  return renderToStaticMarkup(
    await BookingConfirmationPage({ searchParams: Promise.resolve(params) }),
  )
}

const USER = {
  id: 'u1',
  email: 'somchai@ku.th',
  fullName: 'สมชาย ใจดี',
  imageUrl: null,
  role: 'user',
  isBlocked: false,
}

const BOOKING = {
  bookingCode: '123456',
  status: 'PENDING',
  roomName: 'S-101',
  roomTypeCode: 'S',
  bookingDate: '2026-10-19',
  startTime: new Date('2026-10-19T02:30:00Z'), // 09:30 Bangkok
  endTime: new Date('2026-10-19T03:30:00Z'), // 10:30 Bangkok
}

describe('หน้ายืนยันการจอง (/user/booking/confirmation)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireUserMock.mockResolvedValue(USER)
    getBookingConfirmationMock.mockResolvedValue(BOOKING)
  })

  it('บังคับเข้าสู่ระบบ และค้นการจองด้วยรหัสจาก ?code= ของผู้ใช้คนเดียวกัน', async () => {
    await renderPage({ code: '123456' })

    expect(requireUserMock).toHaveBeenCalledTimes(1)
    expect(getBookingConfirmationMock).toHaveBeenCalledWith('123456', 'u1')
  })

  it('จองสำเร็จ: แสดงรหัสการจอง 6 หลักบนหน้าพร้อมห้องและเวลา', async () => {
    const html = await renderPage({ code: '123456' })

    expect(html).toContain('123456')
    expect(html).toContain('จองสำเร็จ')
    expect(html).toContain('S-101')
    expect(html).toContain('09:30')
    expect(html).toContain('10:30')
    expect(html).toContain('2569') // ปีพุทธศักราช
    expect(html).toContain('รับกุญแจ')
  })

  it('รหัสไม่ถูกต้อง (ไม่ใช่ตัวเลข 6 หลัก): ไม่ค้นในฐานข้อมูล แจ้งไม่พบรหัส', async () => {
    const html = await renderPage({ code: 'abc' })

    expect(getBookingConfirmationMock).not.toHaveBeenCalled()
    expect(html).toContain('ไม่พบรหัสการจอง')
    expect(html).not.toContain('123456')
  })

  it('หารหัสไม่เจอ (ไม่ใช่ของผู้ใช้คนนี้): แจ้งไม่พบรหัส ไม่ throw', async () => {
    getBookingConfirmationMock.mockResolvedValue(null)

    const html = await renderPage({ code: '999999' })

    expect(getBookingConfirmationMock).toHaveBeenCalledWith('999999', 'u1')
    expect(html).toContain('ไม่พบรหัสการจอง')
    expect(html).not.toContain('999999')
  })

  it('ไม่ส่ง ?code= เลย: แจ้งไม่พบรหัส พร้อมทางกลับไปหน้าจอง', async () => {
    const html = await renderPage({})

    expect(getBookingConfirmationMock).not.toHaveBeenCalled()
    expect(html).toContain('ไม่พบรหัสการจอง')
    expect(html).toContain('href="/user/booking"')
  })
})
