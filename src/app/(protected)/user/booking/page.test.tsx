import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { requireUserMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
}))

vi.mock('@/lib/auth/guards', () => ({ requireUser: requireUserMock }))

// แผงช่องว่างแตะ db จริง — แทนที่ด้วยป้ายแสดงวันที่ที่ได้รับ เพื่อตรวจการส่งต่อวันที่
vi.mock('./availability-panel', () => ({
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

  it('ส่งวันที่จาก ?date= ไปยังตัวเลือกวันและแผงช่องว่าง', async () => {
    const html = await renderPage({ date: '2026-10-20' })

    expect(html).toContain('data-date="2026-10-20"')
    // ช่องเลือกวันที่ในตัวเปลี่ยนวันค้างค่าวันที่ที่เลือก
    expect(html).toMatch(/<input[^>]*value="2026-10-20"/)
    // ปุ่มวันก่อนหน้า/ถัดไปของ 2026-10-20
    expect(html).toContain('date=2026-10-19')
    expect(html).toContain('date=2026-10-21')
  })

  it('วันที่ไม่ถูกต้องหรือไม่ได้ส่งมา ใช้วันนี้ในกรุงเทพฯ แทน', async () => {
    const invalid = await renderPage({ date: 'not-a-date' })
    expect(invalid).toContain('data-date="2026-10-19"')

    const missing = await renderPage()
    expect(missing).toContain('data-date="2026-10-19"')

    // ?date= ซ้ำกันหลายค่า (Next ส่งเป็น string[]) เอาค่าแรก
    const repeated = await renderPage({ date: ['2026-10-21', 'not-a-date'] })
    expect(repeated).toContain('data-date="2026-10-21"')
  })

  it('แสดงชื่อผู้ใช้และแผงช่องว่างโดยไม่ติด fallback ของ Suspense', async () => {
    const html = await renderPage()

    expect(html).toContain('สมชาย')
    expect(html).toContain('data-testid="availability-panel"')
    expect(html).not.toContain('กำลังโหลดตารางห้องเรียน')
  })
})
