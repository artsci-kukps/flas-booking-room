import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { getDayAvailabilityMock } = vi.hoisted(() => ({
  getDayAvailabilityMock: vi.fn(),
}))

vi.mock('@/lib/booking/day-availability', () => ({
  getDayAvailability: getDayAvailabilityMock,
}))

import type { DayAvailability, RoomSlotView } from '@/lib/booking/day-availability'

import AvailabilityPanel from './availability-panel'

/** ป้าย <button> ทั้งหมดใน HTML — ใช้ตรวจ disabled ต่อป้าย */
function buttonTags(html: string): string[] {
  return [...html.matchAll(/<button[^>]*>/g)].map((match) => match[0]!)
}

/**
 * หาป้าย <button> ที่ aria-label ขึ้นต้นด้วยข้อความที่ระบุ —
 * ช่องที่เลือกไม่ได้มีเหตุผลต่อท้ายใน aria-label (เช่น "... น. ว่าง (เวลาผ่านไปแล้ว)")
 * จึงเทียบแบบ prefix ไม่ใช่ equality
 */
function buttonWithAriaLabel(html: string, ariaLabel: string): string | undefined {
  return buttonTags(html).find((tag) => {
    const match = tag.match(/aria-label="([^"]*)"/)
    return match?.[1]?.startsWith(ariaLabel) ?? false
  })
}

/**
 * ตรวจ attribute `disabled จริง ๆ — ไม่นับ `disabled:` ที่เป็นค่า class ของ Tailwind
 */
function hasDisabledAttr(tag: string | undefined): boolean {
  return /\sdisabled(?=[\s=>])/.test(tag ?? '')
}

function makeSlot(overrides: Partial<RoomSlotView> = {}): RoomSlotView {
  return {
    start: '08:30',
    end: '09:30',
    status: 'free',
    usedCount: 0,
    past: false,
    selectable: true,
    ...overrides,
  }
}

/** วันทำการเปิด: ห้อง CAPACITY 1 ห้อง + ห้อง EXCLUSIVE 1 ห้อง ครบ 4 สถานะ */
const OPEN_DAY: DayAvailability = {
  date: '2026-10-19',
  open: true,
  kind: 'NORMAL',
  openTime: '08:30',
  closeTime: '16:30',
  slots: [
    { start: '08:30', end: '09:30' },
    { start: '09:30', end: '10:30' },
    { start: '10:30', end: '11:30' },
    { start: '11:30', end: '12:30' },
  ],
  rooms: [
    {
      id: 'room-s',
      name: 'S-101',
      roomTypeCode: 'S',
      roomTypeName: 'ห้องทั่วไป',
      bookingMode: 'CAPACITY',
      maxCapacity: 4,
      slots: [
        makeSlot(),
        makeSlot({ start: '09:30', end: '10:30', status: 'occupied', usedCount: 2 }),
        makeSlot({ start: '10:30', end: '11:30', status: 'blocked', selectable: false }),
        makeSlot({ start: '11:30', end: '12:30', past: true, selectable: false }),
      ],
    },
    {
      id: 'room-g',
      name: 'G-101',
      roomTypeCode: 'G',
      roomTypeName: 'ห้องประชุมใหญ่',
      bookingMode: 'EXCLUSIVE',
      maxCapacity: null,
      slots: [
        makeSlot({ status: 'occupied', usedCount: 1, selectable: false }),
        makeSlot({ start: '09:30', end: '10:30' }),
      ],
    },
  ],
}

describe('availability panel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDayAvailabilityMock.mockResolvedValue(OPEN_DAY)
  })

  it('วันเปิด: แสดงวันที่ไทย เวลาทำการ และชื่อห้องทุกห้อง', async () => {
    const html = renderToStaticMarkup(await AvailabilityPanel({ date: '2026-10-19' }))

    expect(getDayAvailabilityMock).toHaveBeenCalledWith('2026-10-19')
    expect(html).toContain('2569') // ปีพุทธศักราชจาก formatThaiDate
    expect(html).toContain('08:30–16:30')
    expect(html).toContain('S-101')
    expect(html).toContain('G-101')
    expect(html).toContain('ห้องทั่วไป')
  })

  it('วันเปิด: แสดงสถานะครบทุกแบบ — ว่าง / ไม่ว่างพร้อมจำนวนที่ใช้ / ถูกบล็อก / ผ่านไปแล้ว', async () => {
    const html = renderToStaticMarkup(await AvailabilityPanel({ date: '2026-10-19' }))

    expect(html).toContain('ว่าง')
    expect(html).toContain('ไม่ว่าง 2/4') // CAPACITY แสดงจำนวนที่ใช้เทียบ max_capacity
    expect(html).toContain('ไม่ว่าง</span>') // EXCLUSIVE ไม่แสดงจำนวน (ป้ายใน span แยก)
    expect(html).toContain('ถูกบล็อก')
    expect(html).toContain('ผ่านไปแล้ว')
    expect(html).toContain('08:30–09:30')

    // โทนสีตามระบบ: ว่าง = เขียว KU, ไม่ว่าง = amber, ถูกบล็อก/ผ่านไปแล้ว = canvas เงียบ
    expect(html).toContain('bg-ku-soft')
    expect(html).toContain('bg-amber-soft')
    expect(html).toContain('bg-canvas')
  })

  it('วันเปิด: ปิดปุ่มเฉพาะช่องที่เลือกไม่ได้ (ผ่านไปแล้ว/ถูกบล็อก/เต็ม/มีคนจอง)', async () => {
    const html = renderToStaticMarkup(await AvailabilityPanel({ date: '2026-10-19' }))

    // เลือกได้ — ว่างของสองห้อง และ CAPACITY ที่ยังไม่เต็ม (ไม่มีคำว่า disabled ในแท็ก)
    const sFree = buttonWithAriaLabel(html, '08:30–09:30 น. ว่าง')
    expect(hasDisabledAttr(sFree)).toBe(false)
    const sCap = buttonWithAriaLabel(html, '09:30–10:30 น. ไม่ว่าง 2/4')
    expect(hasDisabledAttr(sCap)).toBe(false)

    // เลือกไม่ได้
    expect(hasDisabledAttr(buttonWithAriaLabel(html, '10:30–11:30 น. ถูกบล็อก'))).toBe(true)
    expect(hasDisabledAttr(buttonWithAriaLabel(html, '11:30–12:30 น. ผ่านไปแล้ว'))).toBe(true)
    expect(hasDisabledAttr(buttonWithAriaLabel(html, '08:30–09:30 น. ไม่ว่าง'))).toBe(true)
  })

  it('วันเสาร์–อาทิตย์: แสดงข้อความปิดทำการ ไม่แสดงห้อง', async () => {
    getDayAvailabilityMock.mockResolvedValue({
      date: '2026-10-17',
      open: false,
      reason: 'weekend',
      holidayName: null,
    } satisfies DayAvailability)

    const html = renderToStaticMarkup(await AvailabilityPanel({ date: '2026-10-17' }))

    expect(html).toContain('ปิดทำการ')
    expect(html).toContain('เสาร์')
    expect(html).not.toContain('S-101')
  })

  it('วันหยุด: แสดงชื่อวันหยุดกำกับ', async () => {
    getDayAvailabilityMock.mockResolvedValue({
      date: '2026-10-19',
      open: false,
      reason: 'holiday',
      holidayName: 'วันปิยมหาราช',
    } satisfies DayAvailability)

    const html = renderToStaticMarkup(await AvailabilityPanel({ date: '2026-10-19' }))

    expect(html).toContain('วันปิยมหาราช')
    expect(html).toContain('ปิดทำการ')
  })

  it('ยังไม่มีช่วงเวลาให้บริการ: แจ้งให้ผู้ใช้ทราบ', async () => {
    getDayAvailabilityMock.mockResolvedValue({
      date: '2026-10-19',
      open: false,
      reason: 'no-service-period',
      holidayName: null,
    } satisfies DayAvailability)

    const html = renderToStaticMarkup(await AvailabilityPanel({ date: '2026-10-19' }))

    expect(html).toContain('ยังไม่มีช่วงเวลาให้บริการ')
  })
})
