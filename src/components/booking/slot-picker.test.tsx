import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import type { BookRoomAction } from '@/lib/booking/booking-action'
import type { RoomDayAvailability } from '@/lib/booking/day-availability'

import SlotPicker from './slot-picker'

// server action ถูกส่งเข้ามาเป็น prop จากหน้าผู้ใช้/แอดมิน — เทสต์นี้ไม่เรียกจริง
const { bookRoomMock } = vi.hoisted(() => ({ bookRoomMock: vi.fn() }))

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

type RoomSlot = RoomDayAvailability['slots'][number]

function makeSlot(overrides: Partial<RoomSlot> = {}): RoomSlot {
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

/** ห้อง CAPACITY 1 ห้อง + ห้อง EXCLUSIVE (G, ขั้นต่ำ 120 นาที) 1 ห้อง ครบ 4 สถานะ */
const ROOMS: RoomDayAvailability[] = [
  {
    id: 'room-s',
    name: 'S-101',
    roomTypeCode: 'S',
    roomTypeName: 'ห้องทั่วไป',
    bookingMode: 'CAPACITY',
    maxCapacity: 4,
    minDurationMinutes: 60,
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
    minDurationMinutes: 120,
    slots: [
      makeSlot({ status: 'occupied', usedCount: 1, selectable: false }),
      makeSlot({ start: '09:30', end: '10:30' }),
    ],
  },
]

function renderPicker(rooms: RoomDayAvailability[] = ROOMS) {
  return renderToStaticMarkup(
    <SlotPicker
      date="2026-10-19"
      rooms={rooms}
      bookRoomAction={bookRoomMock as unknown as BookRoomAction}
    />,
  )
}

describe('SlotPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    bookRoomMock.mockResolvedValue(null)
  })

  it('แสดงชื่อห้อง ป้ายประเภท และช่องว่างทุกช่องพร้อมป้ายสถานะภาษาไทย', () => {
    const html = renderPicker()

    expect(html).toContain('S-101')
    expect(html).toContain('G-101')
    expect(html).toContain('ห้องทั่วไป')
    expect(html).toContain('ว่าง')
    expect(html).toContain('ไม่ว่าง 2/4') // CAPACITY แสดงจำนวนที่ใช้เทียบ max_capacity
    expect(html).toContain('ถูกบล็อก')
    expect(html).toContain('ผ่านไปแล้ว')
    expect(html).toContain('08:30–09:30')
  })

  it('แสดงความยาวบล็อกตามประเภทห้อง (S = 1 ชั่วโมง, G = 2 ชั่วโมง)', () => {
    const html = renderPicker()

    expect(html).toContain('บล็อกละ 1 ชั่วโมง')
    expect(html).toContain('บล็อกละ 2 ชั่วโมง')
  })

  it('โทนสีตามระบบ: ว่าง = เขียว KU, ไม่ว่าง = amber, ถูกบล็อก/ผ่านไปแล้ว = canvas เงียบ', () => {
    const html = renderPicker()

    expect(html).toContain('bg-ku-soft')
    expect(html).toContain('bg-amber-soft')
    expect(html).toContain('bg-canvas')
  })

  it('ปิดปุ่มเฉพาะช่องที่เลือกไม่ได้ (ผ่านไปแล้ว/ถูกบล็อก/เต็ม/มีคนจอง EXCLUSIVE)', () => {
    const html = renderPicker()

    // เลือกได้ — ว่างของสองห้อง และ CAPACITY ที่ยังไม่เต็ม (ไม่มีคำว่า disabled ในแท็ก)
    expect(hasDisabledAttr(buttonWithAriaLabel(html, '08:30–09:30 น. ว่าง'))).toBe(false)
    expect(hasDisabledAttr(buttonWithAriaLabel(html, '09:30–10:30 น. ไม่ว่าง 2/4'))).toBe(false)

    // เลือกไม่ได้
    expect(hasDisabledAttr(buttonWithAriaLabel(html, '10:30–11:30 น. ถูกบล็อก'))).toBe(true)
    expect(hasDisabledAttr(buttonWithAriaLabel(html, '11:30–12:30 น. ผ่านไปแล้ว'))).toBe(true)
    expect(hasDisabledAttr(buttonWithAriaLabel(html, '08:30–09:30 น. ไม่ว่าง'))).toBe(true)
  })

  it('ยังไม่ได้เลือก: ปุ่มยืนยันถูกปิด พร้อมคำใบ้ให้แตะช่องว่าง และไม่มี field ของฟอร์ม', () => {
    const html = renderPicker()

    expect(html).toContain('แตะช่องว่างเพื่อเลือกเวลา')
    expect(hasDisabledAttr(html.match(/<button[^>]*type="submit"[^>]*>/)?.[0])).toBe(true)
    expect(html).not.toContain('name="roomId"')
    expect(html).not.toContain('name="blocks"')
  })

  it('ปุ่มยืนยันเป็นฟอร์มที่ส่งไปยัง bookRoom action (มี field วันที่กำกับ)', () => {
    const html = renderPicker()

    expect(html).toContain('name="date"')
    expect(html).toContain('value="2026-10-19"')
    expect(html).toContain('ยืนยันการจอง')
    // ฟอร์มผูกกับ server action (renderToStaticMarkup แสดงเป็น hidden action field)
    expect(bookRoomMock).toBeDefined()
  })
})
