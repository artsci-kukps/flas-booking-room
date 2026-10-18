import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import DaySwitcher from './day-switcher'

describe('day switcher', () => {
  it('แสดงวันที่ปัจจุบันในรูปแบบไทย', () => {
    const html = renderToStaticMarkup(<DaySwitcher date="2026-10-19" />)

    expect(html).toContain('19 ต.ค. 2569')
  })

  it('มีปุ่มวันก่อนหน้า วันถัดไป และช่องเลือกวันที่', () => {
    const html = renderToStaticMarkup(<DaySwitcher date="2026-10-19" />)

    expect(html).toContain('วันก่อนหน้า')
    expect(html).toContain('วันถัดไป')
    expect(html).toMatch(/<input[^>]*type="date"/)
  })

  it('ช่องเลือกวันที่ค้างค่าวันที่ปัจจุบัน และส่งเป็นฟอร์ม GET ?date=', () => {
    const html = renderToStaticMarkup(<DaySwitcher date="2026-10-19" />)

    expect(html).toContain('value="2026-10-19"')
    expect(html).toContain('name="date"')
    expect(html).toMatch(/<form[^>]*method="get"/)
  })

  it('มีลิงก์เปลี่ยนวันเป็นพารามิเตอร์ ?date= ถอยหลังและไปข้างหน้าคนละวัน', () => {
    const html = renderToStaticMarkup(<DaySwitcher date="2026-10-19" />)

    expect(html).toContain('date=2026-10-18')
    expect(html).toContain('date=2026-10-20')
  })
})
