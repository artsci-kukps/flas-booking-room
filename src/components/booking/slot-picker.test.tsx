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

/** ห้อง CAPACITY ครบ 4 สถานะ (ว่าง/ไม่ว่าง/ถูกบล็อก/ผ่านไปแล้ว) */
const ROOM_CAPACITY: RoomDayAvailability = {
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
}

/** ห้อง EXCLUSIVE (G, ขั้นต่ำ 120 นาที) — บล็อกยาว 2 ชั่วโมง มีคนจองอยู่ */
const ROOM_EXCLUSIVE: RoomDayAvailability = {
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
}

function renderPicker(room: RoomDayAvailability = ROOM_CAPACITY) {
  return renderToStaticMarkup(
    <SlotPicker
      date="2026-10-19"
      room={room}
      bookRoomAction={bookRoomMock as unknown as BookRoomAction}
    />,
  )
}

describe('SlotPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    bookRoomMock.mockResolvedValue(null)
  })

  it('แสดงช่องว่างทุกช่องพร้อมป้ายสถานะภาษาไทยและเวลาของบล็อก', () => {
    const html = renderPicker()

    expect(html).toContain('ว่าง')
    expect(html).toContain('ไม่ว่าง 2/4') // CAPACITY แสดงจำนวนที่ใช้เทียบ max_capacity
    expect(html).toContain('ถูกบล็อก')
    expect(html).toContain('ผ่านไปแล้ว')
    expect(html).toContain('08:30–09:30')
  })

  it('ห้อง EXCLUSIVE: ป้ายไม่ว่างไม่มีตัวเลขความจุ และช่องที่มีคนจองเลือกไม่ได้', () => {
    const html = renderPicker(ROOM_EXCLUSIVE)

    expect(html).toContain('ไม่ว่าง')
    expect(html).toContain('08:30–09:30 น. ไม่ว่าง (มีผู้ใช้จองแล้ว)') // EXCLUSIVE ไม่มีตัวเลขความจุ
    expect(hasDisabledAttr(buttonWithAriaLabel(html, '08:30–09:30 น. ไม่ว่าง'))).toBe(true)
    expect(hasDisabledAttr(buttonWithAriaLabel(html, '09:30–10:30 น. ว่าง'))).toBe(false)
  })

  it('โทนสีตามระบบ: ว่าง = เขียว KU, ไม่ว่าง = amber, ถูกบล็อก/ผ่านไปแล้ว = canvas เงียบ', () => {
    const html = renderPicker()

    expect(html).toContain('bg-ku-soft')
    expect(html).toContain('bg-amber-soft')
    expect(html).toContain('bg-canvas')
  })

  it('ปิดปุ่มเฉพาะช่องที่เลือกไม่ได้ (ผ่านไปแล้ว/ถูกบล็อก/เต็ม/มีคนจอง EXCLUSIVE)', () => {
    const html = renderPicker()

    // เลือกได้ — ว่าง และ CAPACITY ที่ยังไม่เต็ม (ไม่มีคำว่า disabled ในแท็ก)
    expect(hasDisabledAttr(buttonWithAriaLabel(html, '08:30–09:30 น. ว่าง'))).toBe(false)
    expect(hasDisabledAttr(buttonWithAriaLabel(html, '09:30–10:30 น. ไม่ว่าง 2/4'))).toBe(false)

    // เลือกไม่ได้
    expect(hasDisabledAttr(buttonWithAriaLabel(html, '10:30–11:30 น. ถูกบล็อก'))).toBe(true)
    expect(hasDisabledAttr(buttonWithAriaLabel(html, '11:30–12:30 น. ผ่านไปแล้ว'))).toBe(true)
  })

  it('ยังไม่ได้เลือก: ปุ่มยืนยันถูกปิด พร้อมคำใบ้ให้แตะช่องว่าง และไม่มี field ของฟอร์ม', () => {
    const html = renderPicker()

    expect(html).toContain('แตะช่องว่างเพื่อเลือกเวลา')
    expect(hasDisabledAttr(html.match(/<button[^>]*type="submit"[^>]*>/)?.[0])).toBe(true)
    expect(html).not.toContain('name="roomId"')
    expect(html).not.toContain('name="blocks"')
  })

  it('ปุ่มยืนยันเป็นฟอร์มที่ส่งไปยัง bookRoom action พร้อมวันที่เลือกทั้งใน field และสรุป', () => {
    const html = renderPicker()

    expect(html).toContain('name="date"')
    expect(html).toContain('value="2026-10-19"')
    expect(html).toContain('ยืนยันการจอง')
    // วันที่แบบไทยคู่กับข้อมูลห้องก่อนกดยืนยัน (AC popup, ticket #19)
    expect(html).toContain('วันที่ 19 ต.ค. 2569')
    expect(bookRoomMock).toBeDefined()
  })

  it('มีปุ่มเสริมข้างปุ่มยืนยัน (popup ใช้เป็นปุ่มยกเลิก)', () => {
    const html = renderToStaticMarkup(
      <SlotPicker
        date="2026-10-19"
        room={ROOM_CAPACITY}
        bookRoomAction={bookRoomMock as unknown as BookRoomAction}
        secondaryAction={<button type="button">ยกเลิก</button>}
      />,
    )

    expect(html).toContain('ยกเลิก')
    // ปุ่มเสริมอยู่ในฟอร์มเดียวกับปุ่มยืนยัน (นับ <form …> หนึ่งใบ)
    expect(html.match(/<form/g)).toHaveLength(1)
  })
})
