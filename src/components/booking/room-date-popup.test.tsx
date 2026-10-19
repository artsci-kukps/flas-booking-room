import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

import { bookingDateOptions } from '@/lib/booking/booking-date'

import RoomDatePopup from './room-date-popup'

const ROOMS = [
  { id: 'room-s', name: 'S-101', roomTypeCode: 'S', roomTypeName: 'ห้องทั่วไป' },
  { id: 'room-g', name: 'G-101', roomTypeCode: 'G', roomTypeName: 'ห้องประชุมใหญ่' },
]

function renderPopup(basePath = '/user/booking') {
  return renderToStaticMarkup(
    <RoomDatePopup
      rooms={ROOMS}
      dates={bookingDateOptions('2026-10-19')}
      basePath={basePath}
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

  it('มีปุ่มยกเลิกและปุ่มไปขั้นเลือกเวลา', () => {
    const html = renderPopup()

    expect(html).toContain('ยกเลิก')
    expect(html).toContain('เลือกเวลา')
  })
})
