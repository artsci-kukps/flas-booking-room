import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { BLOCK_LENGTH_COPY } from '@/lib/booking/slot-display'

import ServiceHoursSection from './service-hours-section'

describe('ส่วนเวลาทำการ', () => {
  const html = renderToStaticMarkup(<ServiceHoursSection />)

  it('แสดงเวลาให้บริการตาม TOR ข้อ 5', () => {
    expect(html).toContain('เวลาทำการ')
    expect(html).toContain('08:30–16:30')
    expect(html).toContain('08:30–20:30')
  })

  it('ข้อความความยาวบล็อกมาจากชุดข้อความกลางของระบบ (ไม่คัดลอกข้อความไว้เอง)', () => {
    expect(html).toContain(BLOCK_LENGTH_COPY)
  })
})
