import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { requireUserMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
}))

vi.mock('@/lib/auth/guards', () => ({ requireUser: requireUserMock }))

// ตรรกะการจอง/การดึงห้องจริงอยู่ที่ BookingFlow — ที่นี่ตรวจแค่การส่งต่อค่า
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

// คงฟังก์ชันจริงไว้ทั้งหมด ยกเว้น todayInBangkok ที่ล็อกเป็นวันคงที่
vi.mock('@/lib/admin/service-periods', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/admin/service-periods')>()),
  todayInBangkok: () => '2026-10-19',
}))

import { BLOCK_LENGTH_COPY } from '@/lib/booking/slot-display'

import BookingPage from './page'

async function renderPage(
  params: Record<string, string | string[] | undefined> = {},
) {
  return renderToStaticMarkup(
    await BookingPage({ searchParams: Promise.resolve(params) }),
  )
}

describe('หน้าจองห้องของผู้ใช้ (/user/booking)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireUserMock.mockResolvedValue({
      fullName: 'สมชาย ใจดี',
      email: 'somchai@ku.ac.th',
    })
  })

  it('บังคับเข้าสู่ระบบก่อนแสดงหน้า', async () => {
    await renderPage()

    expect(requireUserMock).toHaveBeenCalledTimes(1)
  })

  it('ส่งวันนี้ในกรุงเทพฯ ให้ขั้นตอนการจอง', async () => {
    const html = await renderPage()

    expect(html).toContain('data-today="2026-10-19"')
  })

  it('ส่งวันที่และห้องจาก ?date=, ?room= ต่อให้ขั้นตอนการจอง', async () => {
    const html = await renderPage({ date: '2026-10-20', room: 'room-g' })

    expect(html).toContain('data-date="2026-10-20"')
    expect(html).toContain('data-room="room-g"')
  })

  it('วันที่ผิดรูปแบบถือว่าไม่ระบุ (ให้ขั้นตอนการจองเริ่มจากเลือกห้อง)', async () => {
    const html = await renderPage({ date: 'not-a-date' })

    expect(html).toContain('data-date=""')
  })

  it('?date= ซ้ำกันหลายค่า (Next ส่งเป็น string[]) เอาค่าแรก', async () => {
    const html = await renderPage({ date: ['2026-10-21', 'not-a-date'] })

    expect(html).toContain('data-date="2026-10-21"')
  })

  it('แสดงชื่อผู้ใช้และหัวข้อจองห้อง', async () => {
    const html = await renderPage()

    expect(html).toContain('สมชาย')
    expect(html).toContain('จองห้อง')
  })

  it('ข้อความกติกาเวลาจองบอกบล็อกตามประเภทห้อง (ไม่คงข้อความบล็อกละ 1 ชั่วโมงเดิม)', async () => {
    const html = await renderPage()

    expect(html).not.toContain('เป็นบล็อกละ 1 ชั่วโมง')
    expect(html).toContain('ห้องทั่วไป/ละหมาด บล็อกละ 1 ชั่วโมง')
    expect(html).toContain('ห้องประชุมใหญ่ บล็อกละ 2 ชั่วโมง')
  })

  it('ข้อความความยาวบล็อกมาจากชุดข้อความกลางของระบบ (ไม่คัดลอกข้อความไว้เอง)', async () => {
    const html = await renderPage()

    expect(html).toContain(BLOCK_LENGTH_COPY)
  })
})
