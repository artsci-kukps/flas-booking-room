import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { requireUserMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
}))

vi.mock('@/lib/auth/guards', () => ({ requireUser: requireUserMock }))

// แผงช่องว่างแตะ db จริง — แทนที่ด้วยป้ายแสดงวันที่ที่ได้รับ เพื่อตรวจการส่งต่อวันที่
vi.mock('@/components/booking/availability-panel', () => ({
  default: ({ date }: { date: string }) => (
    <section data-testid="availability-panel" data-date={date} />
  ),
}))

// คงฟังก์ชันจริงไว้ทั้งหมด ยกเว้น todayInBangkok ที่ล็อกเป็นวันคงที่
vi.mock('@/lib/admin/service-periods', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/admin/service-periods')>()),
  todayInBangkok: () => '2026-10-19',
}))

import BookingPage from './page'

async function renderPage(
  params: Record<string, string | string[] | undefined> = {},
) {
  return renderToStaticMarkup(
    await BookingPage({ searchParams: Promise.resolve(params) }),
  )
}

/** href ของลิงก์เลือกวันทั้งหมดใน HTML */
function dateHrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]*\?date=[^"]*)"/g)].map((match) => match[1]!)
}

describe('หน้าจองห้องของผู้ใช้ (/user/booking)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireUserMock.mockResolvedValue({
      fullName: 'สมชาย ใจดี',
      email: 'somchai@ku.ac.th',
    })
  })

  it('ตรวจสิทธิ์ผู้ใช้ก่อนแสดงผล', async () => {
    await renderPage()

    expect(requireUserMock).toHaveBeenCalledTimes(1)
  })

  it('มี popup เลือกวันที่ที่ให้เฉพาะวันนี้และวันพรุ่งนี้', async () => {
    const html = await renderPage()

    expect(html).toContain('เปลี่ยนวันที่')
    expect(html).toContain('วันนี้')
    expect(html).toContain('วันพรุ่งนี้')
    expect(dateHrefs(html)).toContain('/user/booking?date=2026-10-19')
    expect(dateHrefs(html)).toContain('/user/booking?date=2026-10-20')
  })

  it('วันที่เกินกว่าวันพรุ่งนี้ถูกปรับกลับเป็นวันนี้', async () => {
    const html = await renderPage({ date: '2026-10-25' })

    expect(html).toContain('data-date="2026-10-19"')
  })

  it('วันพรุ่งนี้ใช้ได้ตามเดิม', async () => {
    const html = await renderPage({ date: '2026-10-20' })

    expect(html).toContain('data-date="2026-10-20"')
  })

  it('วันที่ไม่ถูกต้องหรือไม่ได้ส่งมา ใช้วันนี้ในกรุงเทพฯ แทน', async () => {
    const invalid = await renderPage({ date: 'not-a-date' })
    expect(invalid).toContain('data-date="2026-10-19"')

    const missing = await renderPage()
    expect(missing).toContain('data-date="2026-10-19"')

    // ?date= ซ้ำกันหลายค่า (Next ส่งเป็น string[]) เอาค่าแรก
    const repeated = await renderPage({ date: ['2026-10-20', 'not-a-date'] })
    expect(repeated).toContain('data-date="2026-10-20"')
  })

  it('แสดงชื่อผู้ใช้และแผงช่องว่างโดยไม่ติด fallback ของ Suspense', async () => {
    const html = await renderPage()

    expect(html).toContain('สมชาย')
    expect(html).toContain('data-testid="availability-panel"')
  })
})