import { describe, expect, it } from 'vitest'

import type { DayAvailability } from './day-availability'

import { dayClosedMessage } from './day-closed'

type ClosedDay = Extract<DayAvailability, { open: false }>

function closed(overrides: Partial<ClosedDay> = {}): ClosedDay {
  return {
    date: '2026-10-17',
    open: false,
    reason: 'weekend',
    holidayName: null,
    ...overrides,
  }
}

/**
 * ข้อความวันปิดทำการที่ popup จองห้องแสดงแทนตารางช่องว่าง
 * (ย้ายมาจาก availability-panel ที่ถูกเลิกใช้เมื่อรวมทุกขั้นตอนเข้า popup — ticket #19)
 */
describe('dayClosedMessage', () => {
  it('วันเสาร์–อาทิตย์: บอกวันที่แบบไทยพร้อมชื่อวัน', () => {
    const message = dayClosedMessage(closed())

    expect(message).toContain('ปิดทำการ')
    expect(message).toContain('17 ต.ค. 2569')
    expect(message).toContain('เสาร์')
  })

  it('วันหยุดนักขัตฤกษ์: แสดงชื่อวันหยุดกำกับ', () => {
    const message = dayClosedMessage(
      closed({ date: '2026-10-19', reason: 'holiday', holidayName: 'วันปิยมหาราช' }),
    )

    expect(message).toBe('ปิดทำการ — วันปิยมหาราช')
  })

  it('วันหยุดที่ไม่มีชื่อ: แจ้งเป็นข้อความกลาง ๆ', () => {
    const message = dayClosedMessage(
      closed({ date: '2026-10-19', reason: 'holiday', holidayName: null }),
    )

    expect(message).toBe('ปิดทำการ (วันหยุดนักขัตฤกษ์)')
  })

  it('ยังไม่มีช่วงเวลาให้บริการ: แจ้งให้ผู้ใช้ทราบ', () => {
    const message = dayClosedMessage(
      closed({ date: '2026-10-19', reason: 'no-service-period' }),
    )

    expect(message).toBe('ยังไม่มีช่วงเวลาให้บริการสำหรับวันที่เลือก')
  })
})
