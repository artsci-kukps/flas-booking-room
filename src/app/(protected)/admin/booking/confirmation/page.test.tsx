import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { requireAdminMock, getBookingConfirmationMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  getBookingConfirmationMock: vi.fn(),
}))

vi.mock('@/lib/auth/guards', () => ({ requireAdmin: requireAdminMock }))
vi.mock('@/lib/booking/reservations', () => ({
  getBookingConfirmation: getBookingConfirmationMock,
}))

import { ADMIN } from '@/lib/admin/test-fixtures'

import AdminBookingConfirmationPage from './page'

async function renderPage(params: Record<string, string | string[] | undefined>) {
  return renderToStaticMarkup(
    await AdminBookingConfirmationPage({ searchParams: Promise.resolve(params) }),
  )
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

describe('หน้ายืนยันการจองของแอดมิน (/admin/booking/confirmation)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminMock.mockResolvedValue(ADMIN)
    getBookingConfirmationMock.mockResolvedValue(BOOKING)
  })

  it('ตรวจสิทธิ์แอดมิน และค้นการจองด้วยรหัสของผู้ใช้คนเดียวกัน', async () => {
    await renderPage({ code: '123456' })

    expect(requireAdminMock).toHaveBeenCalledTimes(1)
    expect(getBookingConfirmationMock).toHaveBeenCalledWith('123456', ADMIN.id)
  })

  it('แสดงรหัสการจองพร้อมลิงก์กลับหน้าจองของแอดมิน', async () => {
    const html = await renderPage({ code: '123456' })

    expect(html).toContain('123456')
    expect(html).toContain('จองสำเร็จ')
    expect(html).toContain('href="/admin/booking"')
  })

  it('ไม่พบรหัส: แจ้งไม่พบพร้อมลิงก์กลับหน้าจองของแอดมิน', async () => {
    getBookingConfirmationMock.mockResolvedValue(null)

    const html = await renderPage({ code: '123456' })

    expect(html).toContain('ไม่พบรหัสการจอง')
    expect(html).toContain('href="/admin/booking"')
  })
})