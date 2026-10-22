import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import type { BookRoomAction } from '@/lib/booking/booking-action'
import type { DayAvailability, RoomSlotView } from '@/lib/booking/day-availability'

import RoomTimeGrid from './room-time-grid'

const bookRoomMock = vi.fn()

const TODAY = '2026-10-19'

function makeSlot(start: string, end: string, overrides: Partial<RoomSlotView> = {}): RoomSlotView {
  return {
    start,
    end,
    status: 'free',
    usedCount: 0,
    past: false,
    selectable: true,
    ...overrides,
  }
}

/** วันเปิด 08:30–16:30 — ห้อง S (CAPACITY 4, บล็อก 60) + ห้อง G (EXCLUSIVE, บล็อก 120) */
function openDay(date: string): Extract<DayAvailability, { open: true }> {
  return {
    date,
    open: true,
    kind: 'NORMAL',
    openTime: '08:30',
    closeTime: '16:30',
    rooms: [
      {
        id: 'room-s',
        name: 'S-101',
        roomTypeCode: 'S',
        roomTypeName: 'ห้องทั่วไป',
        bookingMode: 'CAPACITY',
        maxCapacity: 4,
        minDurationMinutes: 60,
        slots: [
          makeSlot('08:30', '09:30'),
          makeSlot('09:30', '10:30', { status: 'occupied', usedCount: 2 }),
          makeSlot('10:30', '11:30', { status: 'blocked', selectable: false }),
          makeSlot('11:30', '12:30', { past: true, selectable: false }),
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
          makeSlot('08:30', '10:30', { status: 'occupied', usedCount: 1, selectable: false }),
          makeSlot('10:30', '12:30'),
        ],
      },
    ],
  }
}

const CLOSED_DAY: DayAvailability = {
  date: '2026-10-21',
  open: false,
  reason: 'holiday',
  holidayName: 'วันปิยมหาราช',
}

function buttonTags(html: string): string[] {
  return [...html.matchAll(/<button[^>]*>/g)].map((match) => match[0]!)
}

function buttonWithAriaLabel(html: string, ariaLabel: string): string | undefined {
  return buttonTags(html).find((tag) => {
    const match = tag.match(/aria-label="([^"]*)"/)
    return match?.[1]?.startsWith(ariaLabel) ?? false
  })
}

function hasDisabledAttr(tag: string | undefined): boolean {
  return /\sdisabled(?=[\s=>])/.test(tag ?? '')
}

function renderGrid(
  date = TODAY,
  availability: DayAvailability = openDay(TODAY),
) {
  return renderToStaticMarkup(
    <RoomTimeGrid
      date={date}
      today={TODAY}
      availability={availability}
      bookRoomAction={bookRoomMock as unknown as BookRoomAction}
    />,
  )
}

describe('RoomTimeGrid — ตารางห้อง × เวลา (ticket #20)', () => {
  it('แสดงสถานะทุกช่วงเวลาของทุกห้อง (ว่าง/ไม่ว่าง/ถูกบล็อก/ผ่านไปแล้ว) ตาม AC1', () => {
    const html = renderGrid()

    expect(html).toContain('S-101')
    expect(html).toContain('G-101')
    // สถานะของห้อง CAPACITY — แสดงจำนวนที่ใช้เทียบความจุ
    expect(html).toContain('ไม่ว่าง 2/4')
    expect(html).toContain('ถูกบล็อก')
    expect(html).toContain('ผ่านไปแล้ว')
    // หัวคอลัมน์เวลาของแกนกลาง (08:30 → 11:30 ตามช่องยาวสุดของวันนี้)
    expect(html).toContain('>08:30<')
    expect(html).toContain('>11:30<')
  })

  it('บล็อก 2 ชม. ของห้อง G ครอบ 2 คอลัมน์ในแกนเวลาเดียวกับห้อง S', () => {
    const html = renderGrid()

    expect(html).toContain('colSpan="2"')
  })

  it('ปุ่มกดได้เฉพาะช่องที่กติกาอนุญาต: ว่างและ CAPACITY ที่ยังไม่เต็ม = กดได้', () => {
    const html = renderGrid()

    // ว่าง → กดได้
    expect(hasDisabledAttr(buttonWithAriaLabel(html, '08:30–09:30 น. ว่าง'))).toBe(false)
    // CAPACITY 2/4 ยังมีที่ว่าง → กดได้ (คงกติกา CAPACITY ไว้)
    expect(hasDisabledAttr(buttonWithAriaLabel(html, '09:30–10:30 น. ไม่ว่าง 2/4'))).toBe(false)
  })

  it('ช่องที่กติกาไม่อนุญาต = ปิดปุ่ม: EXCLUSIVE ที่มีคนจอง/ถูกบล็อก/ผ่านไปแล้ว', () => {
    const html = renderGrid()

    expect(hasDisabledAttr(buttonWithAriaLabel(html, '08:30–10:30 น. ไม่ว่าง'))).toBe(true)
    expect(hasDisabledAttr(buttonWithAriaLabel(html, '10:30–11:30 น. ถูกบล็อก'))).toBe(true)
    expect(hasDisabledAttr(buttonWithAriaLabel(html, '11:30–12:30 น. ผ่านไปแล้ว'))).toBe(true)
  })

  it('มีคำใบ้ให้คลิกช่องว่างเพื่อจอง และสัญลักษณ์สถานะ', () => {
    const html = renderGrid()

    expect(html).toContain('คลิกช่องว่างในตารางเพื่อเปิด popup จอง')
    expect(html).toContain('สัญลักษณ์สถานะ')
  })

  it('แสดงช่วงเวลาให้บริการของวันนั้น (เปิด–ปิด)', () => {
    const html = renderGrid()

    expect(html).toContain('เวลาให้บริการ 08:30–16:30')
  })

  it('ดูวันนอกหน้าต่างการจอง (วันนี้/วันพรุ่งนี้) = ตารางดูอย่างเดียว ทุกปุ่มถูกปิด พร้อมคำอธิบาย', () => {
    const html = renderGrid('2026-10-21')

    expect(html).toContain('หน้าต่างการจองคือวันนี้และวันพรุ่งนี้')
    expect(html).not.toContain('คลิกช่องว่างในตารางเพื่อเปิด popup จอง')
    expect(buttonTags(html).every((tag) => hasDisabledAttr(tag))).toBe(true)
  })

  it('ช่องที่อยู่นอกหน้าต่างการจอง = คงสีสถานะ แต่ตัด hover/cursor ของปุ่มออก', () => {
    const html = renderGrid('2026-10-21')

    // ช่องว่าง — เขียว KU แบบไม่มี cursor-pointer/hover
    const freeTag = buttonWithAriaLabel(html, '08:30–09:30 น. ว่าง')
    expect(freeTag).toContain('bg-ku-soft')
    expect(freeTag).toContain('text-ku')
    expect(freeTag).not.toContain('cursor-pointer')
    expect(freeTag).not.toContain('hover:bg-ku')

    // ช่องไม่ว่าง (CAPACITY ยังไม่เต็ม) — amber แบบไม่มี cursor-pointer
    const occupiedTag = buttonWithAriaLabel(html, '09:30–10:30 น. ไม่ว่าง 2/4')
    expect(occupiedTag).toContain('bg-amber-soft')
    expect(occupiedTag).toContain('text-amber-ink')
    expect(occupiedTag).not.toContain('cursor-pointer')
  })

  it('ช่องที่อยู่ในหน้าต่างการจอง = กดได้ พร้อม hover/cursor ของปุ่ม', () => {
    const html = renderGrid()

    const freeTag = buttonWithAriaLabel(html, '08:30–09:30 น. ว่าง')
    expect(freeTag).toContain('cursor-pointer')
    expect(freeTag).toContain('hover:bg-ku')
  })

  it('popup ยังไม่ถูกเรนเดอร์จนกว่าจะคลิกช่องว่าง (เปิดพร้อมข้อมูลที่เลือก)', () => {
    const html = renderGrid()

    expect(html).not.toContain('<dialog')
    expect(html).not.toContain('ยืนยันการจอง')
  })

  it('วันปิดทำการ → แจ้งเหตุผล ไม่วาดตาราง', () => {
    const html = renderGrid('2026-10-21', CLOSED_DAY)

    expect(html).toContain('ปิดทำการ — วันปิยมหาราช')
    expect(html).not.toContain('<table')
    expect(html).not.toContain('S-101')
  })

  it('ช่องว่างไม่มีเลยในวันเปิด → แจ้งว่าไม่มีช่วงเวลาแทนตารางเปล่า', () => {
    const day = openDay(TODAY)
    const empty: DayAvailability = { ...day, rooms: day.rooms.map((room) => ({ ...room, slots: [] })) }

    const html = renderGrid(TODAY, empty)

    expect(html).toContain('ไม่มีช่วงเวลาให้เลือกในวันนี้')
    expect(html).not.toContain('<table')
  })
})
