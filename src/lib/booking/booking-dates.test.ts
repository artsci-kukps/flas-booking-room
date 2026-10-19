import { describe, expect, it } from 'vitest'

import {
  bookingDateOptions,
  isBookableDate,
  resolveBookableDate,
} from './booking-dates'

describe('bookingDateOptions', () => {
  it('ให้ตัวเลือกสองวันเท่านั้น: วันนี้และวันพรุ่งนี้ พร้อมป้ายไทย', () => {
    expect(bookingDateOptions('2026-10-19')).toEqual([
      { date: '2026-10-19', label: 'วันนี้' },
      { date: '2026-10-20', label: 'วันพรุ่งนี้' },
    ])
  })

  it('ข้ามเดือน/ปีได้ถูกต้อง (31 ธ.ค. → 1 ม.ค. ปีถัดไป)', () => {
    expect(bookingDateOptions('2026-12-31')).toEqual([
      { date: '2026-12-31', label: 'วันนี้' },
      { date: '2027-01-01', label: 'วันพรุ่งนี้' },
    ])
  })

  it('ไม่รวมตัวเลือกวันที่เกินกว่าวันพรุ่งนี้หรือก่อนวันนี้', () => {
    const dates = bookingDateOptions('2026-10-19').map((option) => option.date)

    expect(dates).toHaveLength(2)
    expect(dates).not.toContain('2026-10-18')
    expect(dates).not.toContain('2026-10-21')
  })
})

describe('isBookableDate', () => {
  it('วันนี้และวันพรุ่งนี้จองได้', () => {
    expect(isBookableDate('2026-10-19', '2026-10-19')).toBe(true)
    expect(isBookableDate('2026-10-20', '2026-10-19')).toBe(true)
  })

  it('วันที่ผ่านมาแล้วหรือเกินวันพรุ่งนี้จองไม่ได้', () => {
    expect(isBookableDate('2026-10-18', '2026-10-19')).toBe(false)
    expect(isBookableDate('2026-10-21', '2026-10-19')).toBe(false)
    expect(isBookableDate('not-a-date', '2026-10-19')).toBe(false)
  })
})

describe('resolveBookableDate', () => {
  it('วันที่ในกรอบ (วันนี้/พรุ่งนี้) คงไว้ตามเดิม', () => {
    expect(resolveBookableDate('2026-10-19', '2026-10-19')).toBe('2026-10-19')
    expect(resolveBookableDate('2026-10-20', '2026-10-19')).toBe('2026-10-20')
  })

  it('วันที่เกินกว่าวันพรุ่งนี้ถูกปรับกลับเป็นวันนี้ ไม่แสดงวันไกลเกิน', () => {
    expect(resolveBookableDate('2026-10-21', '2026-10-19')).toBe('2026-10-19')
    expect(resolveBookableDate('2027-01-01', '2026-10-19')).toBe('2026-10-19')
  })

  it('วันที่ผ่านมาแล้ว ค่าที่ผิดรูปแบบ หรือไม่ส่งมา ใช้วันนี้', () => {
    expect(resolveBookableDate('2026-10-18', '2026-10-19')).toBe('2026-10-19')
    expect(resolveBookableDate('not-a-date', '2026-10-19')).toBe('2026-10-19')
    expect(resolveBookableDate(undefined, '2026-10-19')).toBe('2026-10-19')
    expect(resolveBookableDate(null, '2026-10-19')).toBe('2026-10-19')
  })

  it('?date= ซ้ำหลายค่า (Next ส่งเป็น string[]) เอาค่าแรกที่อยู่ในกรอบ', () => {
    expect(resolveBookableDate(['2026-10-20', '2026-10-25'], '2026-10-19')).toBe(
      '2026-10-20',
    )
    expect(resolveBookableDate(['2026-10-25', '2026-10-20'], '2026-10-19')).toBe('2026-10-19')
  })
})