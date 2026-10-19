import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { bookingDateOptions } from '@/lib/booking/booking-date'

import DayTabs from './day-tabs'

describe('day tabs', () => {
  it('แสดงเฉพาะวันนี้และวันพรุ่งนี้ พร้อมรักษาห้องที่เลือกไว้', () => {
    const html = renderToStaticMarkup(
      <DayTabs
        basePath="/admin/booking"
        roomId="room-s"
        options={bookingDateOptions('2026-10-19')}
        active="2026-10-19"
      />,
    )

    expect(html).toContain('วันนี้')
    expect(html).toContain('วันพรุ่งนี้')
    expect(html).toContain('/admin/booking?date=2026-10-19&amp;room=room-s')
    expect(html).toContain('/admin/booking?date=2026-10-20&amp;room=room-s')
    expect(html).not.toContain('2026-10-21')
  })

  it('ทำเครื่องหมายวันที่กำลังแสดงด้วย aria-current', () => {
    const html = renderToStaticMarkup(
      <DayTabs
        basePath="/user/booking"
        roomId="room-s"
        options={bookingDateOptions('2026-10-19')}
        active="2026-10-20"
      />,
    )

    expect(html).toMatch(/aria-current="page"[^>]*href="[^"]*date=2026-10-20/)
  })
})
