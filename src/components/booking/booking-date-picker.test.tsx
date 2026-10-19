import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import BookingDatePicker from './booking-date-picker'

const TODAY = '2026-10-19'
const TOMORROW = '2026-10-20'

function render(selected: string = TODAY) {
  return renderToStaticMarkup(
    <BookingDatePicker basePath="/user/booking" today={TODAY} selected={selected} />,
  )
}

/** href ของลิงก์เลือกวันทั้งหมดใน HTML */
function dateHrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]*\?date=[^"]*)"/g)].map((match) => match[1]!)
}

describe('BookingDatePicker', () => {
  it('แสดงวันที่เลือกปัจจุบันเป็นรูปแบบไทย', () => {
    expect(render()).toContain('19 ต.ค. 2569')
  })

  it('เป็น popup แบบไม่พึ่ง JavaScript (details/summary) ที่มีป้ายเปิด', () => {
    const html = render()

    expect(html).toContain('<details')
    expect(html).toContain('<summary')
    expect(html).toContain('เปลี่ยนวันที่')
  })

  it('ให้เลือกเพียงวันนี้และวันพรุ่งนี้ พร้อมลิงก์ ?date= ของแต่ละวัน', () => {
    const html = render()
    const hrefs = dateHrefs(html)

    expect(html).toContain('วันนี้')
    expect(html).toContain('วันพรุ่งนี้')
    expect(hrefs).toContain('/user/booking?date=2026-10-19')
    expect(hrefs).toContain('/user/booking?date=2026-10-20')
    expect(hrefs).toHaveLength(2)
  })

  it('ไม่แสดงตัวเลือกวันที่เกินกว่าวันพรุ่งนี้หรือก่อนวันนี้', () => {
    const html = render()

    expect(html).not.toContain('date=2026-10-18')
    expect(html).not.toContain('date=2026-10-21')
  })

  it('วันที่ที่เลือกอยู่ใช้สีเน้น KU และทำเครื่องหมาย aria-current', () => {
    const html = render(TOMORROW)

    expect(html).toContain('bg-ku-soft')
    expect(html).toContain('text-ku')
    expect(html).toContain('aria-current="page"')
    // ลิงก์ที่เลือกคือวันพรุ่งนี้ จึงมี href ของพรุ่งนี้
    expect(dateHrefs(html)).toContain('/user/booking?date=2026-10-20')
  })

  it('flat ตามดีไซน์ระบบ: ใช้ panel/เส้นขอบ ไม่มีเงา', () => {
    const html = render()

    expect(html).toContain('panel')
    expect(html).toContain('border-border')
    expect(html).not.toContain('shadow')
  })
})