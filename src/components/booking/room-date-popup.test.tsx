import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { bookingDateOptions } from '@/lib/booking/booking-date'
import type { BookRoomAction } from '@/lib/booking/booking-action'
import type { DayAvailability, RoomSlotView } from '@/lib/booking/day-availability'

import RoomDatePopup from './room-date-popup'

const bookRoomMock = vi.fn()

const ROOMS = [
  {
    id: 'room-s',
    name: 'S-101',
    roomTypeCode: 'S',
    roomTypeName: 'ห้องทั่วไป',
    minDurationMinutes: 60,
  },
  {
    id: 'room-g',
    name: 'G-101',
    roomTypeCode: 'G',
    roomTypeName: 'ห้องประชุมใหญ่',
    minDurationMinutes: 120,
  },
]

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

/** วันเปิด — ช่องว่างต่างกันตามวัน เพื่อพิสูจน์ว่า popup ดึงช่องของ "วันที่เลือก" จริง */
function openDay(date: string): DayAvailability {
  const isTomorrow = date === '2026-10-20'
  return {
    date,
    open: true,
    kind: 'NORMAL',
    openTime: '08:30',
    closeTime: '16:30',
    rooms: [
      {
        ...ROOMS[0]!,
        bookingMode: 'CAPACITY',
        maxCapacity: 4,
        slots: [isTomorrow ? makeSlot('10:30', '11:30') : makeSlot('08:30', '09:30')],
      },
      {
        ...ROOMS[1]!,
        bookingMode: 'EXCLUSIVE',
        maxCapacity: null,
        slots: [isTomorrow ? makeSlot('10:30', '12:30') : makeSlot('08:30', '10:30')],
      },
    ],
  }
}

const CLOSED_TOMORROW: DayAvailability = {
  date: '2026-10-20',
  open: false,
  reason: 'holiday',
  holidayName: 'วันปิยมหาราช',
}

function renderPopup(
  overrides: Partial<Parameters<typeof RoomDatePopup>[0]> = {},
) {
  const days = overrides.days ?? [
    { option: bookingDateOptions('2026-10-19')[0]!, availability: openDay('2026-10-19') },
    { option: bookingDateOptions('2026-10-19')[1]!, availability: openDay('2026-10-20') },
  ]

  return renderToStaticMarkup(
    <RoomDatePopup
      rooms={ROOMS}
      days={days}
      bookRoomAction={bookRoomMock as unknown as BookRoomAction}
      {...overrides}
    />,
  )
}

describe('room date popup', () => {
  it('แสดงป้ายห้องทุกห้องพร้อมปุ่มให้เลือก', () => {
    const html = renderPopup()

    expect(html).toContain('S-101')
    expect(html).toContain('G-101')
    expect(html).toContain('ห้องทั่วไป')
    expect(html).toContain('data-room-id="room-s"')
    expect(html).toContain('data-room-id="room-g"')
  })

  it('จัดห้องเป็นกลุ่มตามประเภท โดยเรียง S → G และคงห้องเดิมไว้ในกลุ่ม', () => {
    const html = renderPopup({
      rooms: [
        { ...ROOMS[1]!, id: 'room-g', name: 'G-101' },
        { ...ROOMS[0]!, id: 'room-s-1', name: 'S-101' },
        { ...ROOMS[0]!, id: 'room-s-2', name: 'S-102' },
      ],
    })

    // กลุ่ม S มาก่อน G แม้ข้อมูลตั้งต้นจะเริ่มด้วย G
    const sGroup = html.indexOf('data-room-type-group="S"')
    const gGroup = html.indexOf('data-room-type-group="G"')
    expect(sGroup).toBeGreaterThan(-1)
    expect(gGroup).toBeGreaterThan(sGroup)

    expect(html).toMatch(/id="room-type-S"[^>]*>ห้องทั่วไป<\/h3>/)
    expect(html).toMatch(/id="room-type-G"[^>]*>ห้องประชุมใหญ่<\/h3>/)

    // จำนวนห้องของแต่ละกลุ่ม
    expect(html).toContain('2 ห้อง')
    expect(html).toContain('1 ห้อง')

    // การ์ดทุกห้องยังอยู่ครบ
    expect(html).toContain('data-room-id="room-s-1"')
    expect(html).toContain('data-room-id="room-s-2"')
    expect(html).toContain('data-room-id="room-g"')
  })

  it('ผนังห้องบอกจำนวนช่วงว่างของวันแรกที่เปิด พร้อมวันที่กำกับ', () => {
    const html = renderPopup()

    expect(html.match(/ว่าง 1 ช่วง/g)).toHaveLength(2)
    expect(html).toContain('สถานะวันนี้')
    expect(html).toContain('19 ต.ค. 2569')
  })

  it('วันปิดทั้งสองวัน: ผนังห้องบอกปิดทำการ ไม่แสดงจำนวนช่วงว่าง', () => {
    const closedToday: DayAvailability = {
      date: '2026-10-19',
      open: false,
      reason: 'weekend',
      holidayName: null,
    }

    const html = renderPopup({
      days: [
        { option: bookingDateOptions('2026-10-19')[0]!, availability: closedToday },
        { option: bookingDateOptions('2026-10-19')[1]!, availability: CLOSED_TOMORROW },
      ],
    })

    expect(html).not.toContain('ว่าง 1 ช่วง')
    expect(html.match(/ปิดทำการ/g)).toHaveLength(2)
  })

  it('เป็น popup (<dialog>) พร้อมหัวข้อเลือกวันที่จอง', () => {
    const html = renderPopup()

    expect(html).toMatch(/<dialog[^>]*class="modal"/)
    expect(html).toContain('เลือกวันที่จอง')
  })

  it('ให้เลือกได้เฉพาะวันนี้และวันพรุ่งนี้เท่านั้น', () => {
    const html = renderPopup()

    expect(html).toContain('วันนี้')
    expect(html).toContain('วันพรุ่งนี้')
    // ไม่มีตัวเลือกวันมะรืน (2026-10-21)
    expect(html).not.toContain('2026-10-21')
    // จำนวน radio ของ popup = 2
    expect(html.match(/type="radio"/g)).toHaveLength(2)
  })

  it('แสดงวันที่แบบไทยของทั้งสองตัวเลือก', () => {
    const html = renderPopup()

    expect(html).toContain('19 ต.ค. 2569')
    expect(html).toContain('20 ต.ค. 2569')
    expect(html).not.toContain('21 ต.ค. 2569')
  })

  it('ยังไม่ได้เริ่มจากลิงก์: มีปุ่มยกเลิก แต่ยังไม่มีช่องว่างและปุ่มยืนยัน', () => {
    const html = renderPopup()

    expect(html).toContain('ยกเลิก')
    expect(html).not.toContain('ยืนยันการจอง')
    expect(html).not.toContain('08:30')
    expect(html).not.toContain('บล็อกละ')
  })

  it('เริ่มจากลิงก์ ?room&date: popup มาพร้อมห้อง ประเภท วันที่ ช่องว่างของวันนั้น และปุ่มยืนยัน', () => {
    const html = renderPopup({ initialRoom: ROOMS[1], initialDate: '2026-10-20' })

    // ห้อง + ประเภท (หัว popup) และความยาวบล็อกตามประเภทห้อง (G = 2 ชั่วโมง)
    expect(html).toContain('G-101')
    expect(html).toContain('ห้องประชุมใหญ่')
    expect(html).toContain('บล็อกละ 2 ชั่วโมง')

    // ช่องว่างของ "วันที่เลือก" (2026-10-20) — ไม่ใช่ช่องของวันนี้
    expect(html).toContain('10:30–12:30')
    expect(html).not.toContain('08:30–10:30')

    // เวลาทำการของวัน และวันที่ในสรุปก่อนยืนยัน
    expect(html).toContain('08:30–16:30')
    expect(html).toContain('วันที่ 20 ต.ค. 2569')

    // ยืนยันอยู่ในฟอร์มเดียวกับสรุปและปุ่มยกเลิก — หนึ่งฟอร์มเดียวใน popup
    expect(html).toContain('ยืนยันการจอง')
    expect(html).toContain('ยกเลิก')
    expect(html.match(/<form/g)).toHaveLength(1)
  })

  it('วันที่เลือกปิดทำการ: แสดงข้อความปิดแทนช่องว่าง ไม่มีปุ่มยืนยัน', () => {
    const html = renderPopup({
      days: [
        { option: bookingDateOptions('2026-10-19')[0]!, availability: openDay('2026-10-19') },
        { option: bookingDateOptions('2026-10-19')[1]!, availability: CLOSED_TOMORROW },
      ],
      initialRoom: ROOMS[1],
      initialDate: '2026-10-20',
    })

    expect(html).toContain('ปิดทำการ — วันปิยมหาราช')
    expect(html).not.toContain('ยืนยันการจอง')
    expect(html).not.toContain('10:30–12:30')
    expect(html).toContain('ยกเลิก')
  })
})
