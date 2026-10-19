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

import AdminBookingConfirmationPage from './page'

const ADMIN = {
  id: 'a1',
  email: 'admin@ku.th',
  fullName: 'ผู้ดูแล ระบบ',
  imageUrl: null,
  role: 'admin',
  isBlocked: false,
}

const BOOKING = {
  bookingCode: '123456',
  status: 'PENDING',
  roomName: 'G-101',
  roomTypeCode: 'G',
  bookingDate: '2026-10-19',
  startTime: new Date('2026-10-19T02:30:00Z'),
  endTime: new Date('2026-10-19T04:30:00Z'),
}

async function renderPage(params: Record<string, string | string[] | undefined>) {
  return renderToStaticMarkup(
    await AdminBookingConfirmationPage({ searchParams: Promise.resolve(params) }),
  )
}

describe('หน้ายืนยันการจองของแอดมิน (/admin/booking/confirmation)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminMock.mockResolvedValue(ADMIN)
    getBookingConfirmationMock.mockResolvedValue(BOOKING)
  })

  it('บังคับสิทธิ์แอดมิน และค้นการจองด้วยรหัสของผู้ใช้คนเดียวกัน', async () => {
    await renderPage({ code: '123456' })

    expect(requireAdminMock).toHaveBeenCalledTimes(1)
    expect(getBookingConfirmationMock).toHaveBeenCalledWith('123456', 'a1')
  })

  it('ลิงก์กลับไปหน้าจองและประวัติของแอดมิน ไม่ใช่ของผู้ใช้', async () => {
    const html = await renderPage({ code: '123456' })

    expect(html).toContain('href="/admin/booking"')
    expect(html).toContain('href="/admin/history"')
    expect(html).not.toContain('href="/user/')
  })
})
