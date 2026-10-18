import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { requireAdminMock, listHolidaysMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  listHolidaysMock: vi.fn(),
}))

vi.mock('@/lib/auth/guards', () => ({ requireAdmin: requireAdminMock }))
vi.mock('@/lib/admin/holidays', () => ({
  listHolidays: listHolidaysMock,
  createHoliday: vi.fn(),
  deleteHoliday: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { ADMIN, buttonLabels, makeHoliday } from '@/lib/admin/test-fixtures'

import HolidaysPage from './page'

const SONGKRAN = makeHoliday({
  id: 'h-1',
  holidayDate: '2026-04-06',
  name: 'วันจักรี',
  note: 'ชดเชยวันเสาร์',
})

describe('holidays page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminMock.mockResolvedValue(ADMIN)
    listHolidaysMock.mockResolvedValue([SONGKRAN])
  })

  it('ตรวจสิทธิ์แอดมินก่อนแสดงผล', async () => {
    await HolidaysPage()

    expect(requireAdminMock).toHaveBeenCalledTimes(1)
  })

  it('แสดงรายการวันหยุดพร้อมวันที่ไทยและชื่อ', async () => {
    const html = renderToStaticMarkup(await HolidaysPage())

    expect(html).toContain('วันจักรี')
    expect(html).toContain('เม.ย.')
    expect(html).toContain('ชดเชยวันเสาร์')
  })

  it('มีฟอร์มเพิ่มวันหยุดพร้อมช่องวันที่ ชื่อ และหมายเหตุ', async () => {
    const html = renderToStaticMarkup(await HolidaysPage())

    expect(html).toContain('name="holidayDate"')
    expect(html).toContain('name="name"')
    expect(html).toContain('name="note"')
  })

  it('มีปุ่มลบสำหรับแต่ละวันหยุด', async () => {
    const labels = buttonLabels(renderToStaticMarkup(await HolidaysPage()))

    expect(labels).toContain('ลบ')
  })

  it('แจ้งเมื่อยังไม่มีวันหยุด', async () => {
    listHolidaysMock.mockResolvedValue([])

    const html = renderToStaticMarkup(await HolidaysPage())

    expect(html).toContain('ยังไม่มีวันหยุดนักขัตฤกษ์')
  })
})
