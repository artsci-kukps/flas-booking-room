import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import type { BookRoomAction } from '@/lib/booking/booking-action'
import type { RoomDayAvailability, RoomSlotView } from '@/lib/booking/day-availability'

import GridBookingDialog from './grid-booking-dialog'

const bookRoomMock = vi.fn()

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

/** ห้อง S (CAPACITY, บล็อก 60 นาที) — ช่อง 08:30 ว่างสำหรับคลิกจากตาราง */
const ROOM_S: RoomDayAvailability = {
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
  ],
}

/** ห้อง G (EXCLUSIVE, บล็อก 120 นาที) */
const ROOM_G: RoomDayAvailability = {
  ...ROOM_S,
  id: 'room-g',
  name: 'G-101',
  roomTypeCode: 'G',
  roomTypeName: 'ห้องประชุมใหญ่',
  bookingMode: 'EXCLUSIVE',
  maxCapacity: null,
  minDurationMinutes: 120,
  slots: [makeSlot({ end: '10:30' })],
}

function buttonWithAriaLabel(html: string, ariaLabel: string): string | undefined {
  return [...html.matchAll(/<button[^>]*>/g)]
    .map((match) => match[0]!)
    .find((tag) => tag.match(/aria-label="([^"]*)"/)?.[1]?.startsWith(ariaLabel))
}

function hasDisabledAttr(tag: string | undefined): boolean {
  return /\sdisabled(?=[\s=>])/.test(tag ?? '')
}

function renderDialog(
  overrides: Partial<Parameters<typeof GridBookingDialog>[0]> = {},
) {
  return renderToStaticMarkup(
    <GridBookingDialog
      date="2026-10-19"
      room={ROOM_S}
      slot={makeSlot()}
      openTime="08:30"
      closeTime="16:30"
      bookRoomAction={bookRoomMock as unknown as BookRoomAction}
      onClose={vi.fn()}
      {...overrides}
    />,
  )
}

describe('GridBookingDialog — popup จองจากคลิกช่องว่างในตาราง (ticket #20)', () => {
  it('เปิดพร้อมข้อมูลห้อง ประเภท และวันที่ที่เลือกไว้ล่วงหน้า', () => {
    const html = renderDialog()

    expect(html).toContain('<dialog')
    expect(html).toContain('S-101')
    expect(html).toContain('ห้องทั่วไป')
    expect(html).toContain('วันที่ 19 ต.ค. 2569') // วันที่มาจากตาราง ไม่ต้องเลือกใหม่
    expect(html).toContain('08:30–16:30') // เวลาทำการของวันนั้น
  })

  it('บล็อกที่คลิกในตารางถูกเลือกไว้ใน picker พร้อมฟอร์มยืนยันได้ทันที', () => {
    const html = renderDialog()

    expect(buttonWithAriaLabel(html, '08:30–09:30 น. ว่าง')).toContain('aria-pressed="true"')
    expect(html).toContain('name="roomId"')
    expect(html).toContain('value="room-s"')
    expect(html).toContain('name="date"')
    expect(html).toContain('name="blocks"')
    expect(html).toContain('&quot;start&quot;:&quot;08:30&quot;')
    expect(hasDisabledAttr(html.match(/<button[^>]*type="submit"[^>]*>/)?.[0])).toBe(false)
  })

  it('ใช้บล็อกตามประเภทห้องเดียวกับหน้าจอง (S = 1 ชม.)', () => {
    expect(renderDialog()).toContain('บล็อกละ 1 ชั่วโมง')
  })

  it('ห้อง G บล็อก 2 ชั่วโมง — บล็อกที่คลิกข้ามแนวเวลา 2 คอลัมน์ถูกเลือกไว้', () => {
    const html = renderDialog({
      room: ROOM_G,
      slot: makeSlot({ end: '10:30' }),
    })

    expect(html).toContain('G-101')
    expect(html).toContain('บล็อกละ 2 ชั่วโมง')
    expect(buttonWithAriaLabel(html, '08:30–10:30 น. ว่าง')).toContain('aria-pressed="true"')
    expect(html).toContain('&quot;start&quot;:&quot;08:30&quot;')
  })

  it('มีปุ่มยกเลิกข้างปุ่มยืนยัน และสรุปก่อนยืนยันครบ (ห้อง/วันที่/ช่วงเวลา)', () => {
    const html = renderDialog()

    expect(html).toContain('ยกเลิก')
    expect(html).toContain('ยืนยันการจอง')
    expect(html).toContain('S-101')
    expect(html).toContain('08:30–09:30')
  })
})
