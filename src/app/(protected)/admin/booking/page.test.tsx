import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { requireAdminMock } = vi.hoisted(() => ({ requireAdminMock: vi.fn() }))

vi.mock('@/lib/auth/guards', () => ({ requireAdmin: requireAdminMock }))

// ตรรกะการจอง/db อยู่ที่ BookingFlow — ที่นี่ตรวจแค่การส่งต่อค่าและสิทธิ์
vi.mock('@/components/booking/booking-flow', () => ({
  default: ({
    today,
    date,
    roomId,
  }: {
    today: string
    date?: string | null
    roomId?: string | null
  }) => (
    <section
      data-testid="booking-flow"
      data-today={today}
      data-date={date ?? ''}
      data-room={roomId ?? ''}
    />
  ),
}))

vi.mock('@/lib/admin/service-periods', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/admin/service-periods')>()),
  todayInBangkok: () => '2026-10-19',
}))

import AdminBookingPage from './page'

async function renderPage(
  params: Record<string, string | string[] | undefined> = {},
) {
  return renderToStaticMarkup(
    await AdminBookingPage({ searchParams: Promise.resolve(params) }),
  )
}

describe('หน้าจองห้องของแอดมิน (/admin/booking)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminMock.mockResolvedValue({
      fullName: 'ผู้ดูแล ระบบ',
      email: 'admin@ku.ac.th',
    })
  })

  it('บังคับสิทธิ์แอดมินก่อนแสดงหน้า', async () => {
    await renderPage()

    expect(requireAdminMock).toHaveBeenCalledTimes(1)
  })

  it('ใช้ขั้นตอนการจองชุดเดียวกับผู้ใช้ พร้อมวันนี้ในกรุงเทพฯ', async () => {
    const html = await renderPage()

    expect(html).toContain('data-today="2026-10-19"')
  })

  it('ส่งวันที่และห้องจาก query ต่อให้ขั้นตอนการจอง', async () => {
    const html = await renderPage({ date: '2026-10-20', room: 'room-s' })

    expect(html).toContain('data-date="2026-10-20"')
    expect(html).toContain('data-room="room-s"')
  })
})
