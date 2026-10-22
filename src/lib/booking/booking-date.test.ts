import { describe, expect, it } from 'vitest'

import {
  BOOKING_WINDOW_DAYS,
  bookingDateOptions,
  isBookableBookingDate,
  parseBookingDate,
  parseBookingRoomId,
  shiftBookingDate,
} from './booking-date'

describe('booking date window', () => {
  it('มีหน้าต่างเลือกวันเพียง 2 วัน: วันนี้และวันพรุ่งนี้', () => {
    expect(BOOKING_WINDOW_DAYS).toBe(2)
  })
})

describe('bookingDateOptions', () => {
  it('คืนตัวเลือกสองรายการเท่านั้น: วันนี้และวันพรุ่งนี้ พร้อมวันที่ถัดไปจากวันนี้จริง', () => {
    const options = bookingDateOptions('2026-10-19')

    expect(options.map((option) => option.date)).toEqual(['2026-10-19', '2026-10-20'])
    expect(options.map((option) => option.label)).toEqual(['วันนี้', 'วันพรุ่งนี้'])
  })

  it('ข้ามเดือน/ปีได้ถูกต้อง', () => {
    const options = bookingDateOptions('2026-12-31')

    expect(options.map((option) => option.date)).toEqual(['2026-12-31', '2027-01-01'])
  })

  it('ไม่สร้างตัวเลือกเกินกว่าวันพรุ่งนี้ (วันมะรืนต้องไม่อยู่ในรายการ)', () => {
    const options = bookingDateOptions('2026-10-19')
    const beyondTomorrow = bookingDateOptions('2026-10-19').map((option) => option.date)

    expect(beyondTomorrow).not.toContain('2026-10-21')
    expect(options).toHaveLength(2)
  })

  it('แสดงวันที่แบบไทยและชื่อวันในสัปดาห์', () => {
    const [today, tomorrow] = bookingDateOptions('2026-10-19')

    expect(today?.formatted).toContain('19 ต.ค. 2569')
    expect(today?.weekday).toContain('จันทร์')
    expect(tomorrow?.weekday).toContain('อังคาร')
  })

  it('วันนี้ผิดรูปแบบ คืนรายการว่าง ไม่พัง', () => {
    expect(bookingDateOptions('not-a-date')).toEqual([])
  })
})

describe('isBookableBookingDate', () => {
  it('รับเฉพาะวันนี้และวันพรุ่งนี้', () => {
    expect(isBookableBookingDate('2026-10-19', '2026-10-19')).toBe(true)
    expect(isBookableBookingDate('2026-10-20', '2026-10-19')).toBe(true)
  })

  it('ปฏิเสธวันมะรืน วันก่อนหน้า และค่าที่ผิดรูปแบบ', () => {
    expect(isBookableBookingDate('2026-10-21', '2026-10-19')).toBe(false)
    expect(isBookableBookingDate('2026-10-18', '2026-10-19')).toBe(false)
    expect(isBookableBookingDate('not-a-date', '2026-10-19')).toBe(false)
  })
})

describe('parseBookingDate', () => {
  it('รับค่า ?date=YYYY-MM-DD ที่เป็นวันที่มีจริงบนปฏิทิน', () => {
    expect(parseBookingDate('2026-10-19')).toBe('2026-10-19')
    expect(parseBookingDate(['2026-10-19', '2026-10-20'])).toBe('2026-10-19')
  })

  it('คืน null เมื่อไม่มีค่า รูปแบบผิด หรือวันที่ไม่มีจริง', () => {
    expect(parseBookingDate(undefined)).toBeNull()
    expect(parseBookingDate('')).toBeNull()
    expect(parseBookingDate('19-10-2026')).toBeNull()
    expect(parseBookingDate('not-a-date')).toBeNull()
    expect(parseBookingDate('2026-02-30')).toBeNull()
  })
})

describe('parseBookingRoomId', () => {
  it('ตัดช่องว่าง รับค่าแรกเมื่อซ้ำ และคืน null เมื่อไม่มี/ว่าง', () => {
    expect(parseBookingRoomId('  room-s  ')).toBe('room-s')
    expect(parseBookingRoomId(['room-g', 'room-s'])).toBe('room-g')
    expect(parseBookingRoomId(undefined)).toBeNull()
    expect(parseBookingRoomId('   ')).toBeNull()
  })

  it('คืน null เมื่อค่าว่างเปล่าหรือไม่มีค่าเลย', () => {
    expect(parseBookingRoomId(null)).toBeNull()
    expect(parseBookingRoomId('')).toBeNull()
    expect(parseBookingRoomId([])).toBeNull()
  })
})

describe('shiftBookingDate', () => {
  it('เลื่อนวันไปข้างหน้า/ถอยหลังข้ามเดือนได้', () => {
    expect(shiftBookingDate('2026-10-19', 1)).toBe('2026-10-20')
    expect(shiftBookingDate('2026-10-19', -1)).toBe('2026-10-18')
    expect(shiftBookingDate('2026-11-01', -1)).toBe('2026-10-31')
    expect(shiftBookingDate('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftBookingDate('2026-10-19', 0)).toBe('2026-10-19')
  })
})

