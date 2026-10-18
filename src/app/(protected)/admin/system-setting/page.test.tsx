import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { requireAdminMock, listServicePeriodsMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  listServicePeriodsMock: vi.fn(),
}))

vi.mock('@/lib/auth/guards', () => ({ requireAdmin: requireAdminMock }))
vi.mock('@/lib/admin/service-periods', () => ({
  listServicePeriods: listServicePeriodsMock,
  todayInBangkok: () => '2026-10-18',
  isServicePeriodKind: (value: unknown) => value === 'NORMAL' || value === 'EXAM',
  createServicePeriod: vi.fn(),
  updateServicePeriod: vi.fn(),
  deleteServicePeriod: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { ADMIN, buttonLabels, makeServicePeriod } from '@/lib/admin/test-fixtures'

import SystemSettingPage from './page'

const NORMAL = makeServicePeriod({ id: 'sp-1', name: 'เวลาทำการปกติ' })
const EXAM = makeServicePeriod({
  id: 'sp-2',
  name: 'ช่วงสอบปลายภาค',
  kind: 'EXAM',
  openTime: '08:30',
  closeTime: '20:30',
  effectiveFrom: '2026-05-01',
  effectiveTo: '2026-05-31',
})

describe('system setting page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminMock.mockResolvedValue(ADMIN)
    listServicePeriodsMock.mockResolvedValue([NORMAL, EXAM])
  })

  it('ตรวจสิทธิ์แอดมินก่อนแสดงผล', async () => {
    await SystemSettingPage()

    expect(requireAdminMock).toHaveBeenCalledTimes(1)
  })

  it('แสดงช่วงเวลาให้บริการพร้อมชนิด เวลา และวันที่มีผล', async () => {
    const html = renderToStaticMarkup(await SystemSettingPage())

    expect(html).toContain('เวลาทำการปกติ')
    expect(html).toContain('ช่วงสอบปลายภาค')
    expect(html).toContain('วันปกติ')
    expect(html).toContain('ช่วงสอบ')
    expect(html).toContain('08:30–16:30')
    expect(html).toContain('08:30–20:30')
    expect(html).toContain('ไม่กำหนดสิ้นสุด')
  })

  it('มีฟอร์มเพิ่มช่วงเวลาพร้อมช่องครบทุกฟิลด์', async () => {
    const html = renderToStaticMarkup(await SystemSettingPage())

    expect(html).toContain('name="name"')
    expect(html).toContain('name="kind"')
    expect(html).toContain('name="openTime"')
    expect(html).toContain('name="closeTime"')
    expect(html).toContain('name="effectiveFrom"')
    expect(html).toContain('name="effectiveTo"')
  })

  it('มีปุ่มแก้ไขและลบสำหรับแต่ละช่วงเวลา', async () => {
    const labels = buttonLabels(renderToStaticMarkup(await SystemSettingPage()))

    expect(labels).toContain('แก้ไข')
    expect(labels).toContain('ลบ')
  })

  it('แจ้งเมื่อยังไม่มีช่วงเวลาให้บริการ', async () => {
    listServicePeriodsMock.mockResolvedValue([])

    const html = renderToStaticMarkup(await SystemSettingPage())

    expect(html).toContain('ยังไม่มีช่วงเวลาให้บริการ')
  })
})
