import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import type { BookRoomAction } from '@/lib/booking/booking-action'
import type { DayAvailability } from '@/lib/booking/day-availability'

import RoomStatusSection from './room-status-section'

const bookRoomMock = vi.fn()

const DATE = '2026-10-19'

/** วันเปิด 08:30–10:30 ห้อง S-101 (CAPACITY 4, บล็อก 60) ช่องว่าง 1 ช่อง */
function openDay(): Extract<DayAvailability, { open: true }> {
  return {
    date: DATE,
    open: true,
    kind: 'NORMAL',
    openTime: '08:30',
    closeTime: '10:30',
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
          {
            start: '08:30',
            end: '09:30',
            status: 'free',
            usedCount: 0,
            past: false,
            selectable: true,
          },
        ],
      },
    ],
  }
}

function renderSection() {
  return renderToStaticMarkup(
    <RoomStatusSection
      date={DATE}
      today={DATE}
      availability={openDay()}
      bookRoomAction={bookRoomMock as unknown as BookRoomAction}
    />,
  )
}

describe('RoomStatusSection — ส่วนตารางสถานะห้อง × เวลา (ใช้ร่วมทุกหน้าที่มีตาราง)', () => {
  it('มีหัวข้อบอกวันที่ของตาราง และผูกกับ section ด้วย aria-labelledby', () => {
    const html = renderSection()

    expect(html).toContain('ตารางสถานะห้องวันที่')

    const labelledBy = html.match(/<section[^>]*aria-labelledby="([^"]+)"/)?.[1]

    expect(labelledBy).toBeTruthy()
    expect(html).toContain(`<h2 id="${labelledBy}"`)
  })

  it('มีคำอธิบายสั้นว่าตารางนี้แสดงสถานะอะไร', () => {
    const html = renderSection()

    expect(html).toContain('สถานะช่วงเวลาของทุกห้องในวันเดียว')
  })

  it('วาดตารางห้อง × เวลาไว้ใต้หัวข้อ', () => {
    const html = renderSection()

    expect(html).toContain('สัญลักษณ์สถานะ')
    expect(html).toContain('S-101')
    expect(html).toContain('08:30–09:30 น. ว่าง')
  })
})
