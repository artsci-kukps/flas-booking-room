import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { planBooking } from '@/lib/booking/booking-plan'

import BookingSummary from './booking-summary'

/**
 * สรุปก่อนกดยืนยัน (TOR ภาคผนวก B ข้อ 4) — ต้องบอกจำนวนครั้งที่ต้องยืนยันกับเจ้าหน้าที่
 * พร้อมรายการแต่ละ record (ห้อง ช่วงเวลา) เพื่อให้ผู้ใช้รู้ล่วงหน้าว่าจะได้กี่รหัส
 */

const block = (start: string, end: string) => ({ start, end })

describe('BookingSummary', () => {
  it('ยังไม่เลือกบล็อก: แสดงคำใบ้ให้แตะช่องว่าง', () => {
    const html = renderToStaticMarkup(
      <BookingSummary plan={planBooking([])} roomName="S-101" minDurationMinutes={60} />,
    )

    expect(html).toContain('แตะช่องว่าง')
    expect(html).not.toContain('ต้องยืนยันกับเจ้าหน้าที่')
  })

  it('บล็อกติดกันรวมเป็น 1 record: บอกว่ายืนยัน 1 ครั้ง พร้อมช่วงเวลาเดียว', () => {
    const html = renderToStaticMarkup(
      <BookingSummary
        plan={planBooking([block('08:30', '09:30'), block('09:30', '10:30')])}
        roomName="S-101"
        minDurationMinutes={60}
      />,
    )

    expect(html).toContain('ห้อง S-101')
    expect(html).toContain('08:30–10:30')
    expect(html).toContain('ต้องยืนยันกับเจ้าหน้าที่ 1 ครั้ง')
    expect(html).not.toContain('09:30–10:30')
  })

  it('บล็อกมีช่องว่าง: แสดง 2 record และบอกว่ายืนยัน 2 ครั้ง', () => {
    const html = renderToStaticMarkup(
      <BookingSummary
        plan={planBooking([block('08:30', '09:30'), block('10:30', '11:30')])}
        roomName="S-101"
        minDurationMinutes={60}
      />,
    )

    expect(html).toContain('ต้องยืนยันกับเจ้าหน้าที่ 2 ครั้ง')
    expect(html).toContain('08:30–09:30')
    expect(html).toContain('10:30–11:30')
  })

  it('ระยะเวลาไม่ถึงขั้นต่ำของประเภทห้อง: เตือนพร้อมระยะขั้นต่ำที่ต้องจอง', () => {
    const html = renderToStaticMarkup(
      <BookingSummary
        plan={planBooking([block('08:30', '09:30')])}
        roomName="G-101"
        minDurationMinutes={120}
      />,
    )

    expect(html).toContain('ต้องยืนยันกับเจ้าหน้าที่ 1 ครั้ง')
    expect(html).toContain('อย่างน้อย 120 นาที')
  })

  it('ระยะเวลาถึงขั้นต่ำ: ไม่มีคำเตือน', () => {
    const html = renderToStaticMarkup(
      <BookingSummary
        plan={planBooking([block('08:30', '09:30'), block('09:30', '10:30')])}
        roomName="G-101"
        minDurationMinutes={120}
      />,
    )

    expect(html).not.toContain('อย่างน้อย 120 นาที')
  })
})
