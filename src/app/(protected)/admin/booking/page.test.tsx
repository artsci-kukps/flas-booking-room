import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { requireAdminMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
}))

vi.mock('@/lib/auth/guards', () => ({ requireAdmin: requireAdminMock }))

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

import { ADMIN } from '@/lib/admin/test-fixtures'

import AdminBookingPage from './page'

function render(params: Record<string, string | string[] | undefined> = {}) {
  return AdminBookingPage({ searchParams: Promise.resolve(params) }).then(
    renderToStaticMarkup,
  )
}

/** href ของลิงก์เลือกวันทั้งหมดใน HTML */
function dateHrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]*\?date=[^"]*)"/g)].map((match) => match[1]!)
}

describe('หน้าจองห้องของแอดมิน (/admin/booking)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminMock.mockResolvedValue(ADMIN)
  })

  it('ตรวจสิทธิ์แอดมินก่อนแสดงผล', async () => {
    await render()

    expect(requireAdminMock).toHaveBeenCalledTimes(1)
  })

  it('มี popup เลือกวันที่ที่ให้เฉพาะวันนี้และวันพรุ่งนี้ (เส้นทางของแอดมิน)', async () => {
    const html = await render()

    expect(html).toContain('เปลี่ยนวันที่')
    expect(dateHrefs(html)).toContain('/admin/booking?date=2026-10-19')
    expect(dateHrefs(html)).toContain('/admin/booking?date=2026-10-20')
    expect(dateHrefs(html)).toHaveLength(2)
  })

  it('หลังเลือกวันแล้วแสดงขั้นตอนเลือกเวลา (แผงช่องว่างของวันนั้น)', async () => {
    const html = await render({ date: '2026-10-20' })

    expect(html).toContain('data-date="2026-10-20"')
  })

  it('วันที่เกินกว่าวันพรุ่งนี้ถูกปรับกลับเป็นวันนี้', async () => {
    const html = await render({ date: '2026-10-25' })

    expect(html).toContain('data-date="2026-10-19"')
  })
})