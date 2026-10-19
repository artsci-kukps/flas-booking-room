import { describe, expect, it } from 'vitest'

import {
  BOOKING_WINDOW_DAYS,
  bookingDateOptions,
  bookingDayHref,
  bookingRoomHref,
  isBookableBookingDate,
  parseBookingRoomId,
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

describe('parseBookingRoomId', () => {
  it('ตัดช่องว่าง รับค่าแรกเมื่อซ้ำ และคืน null เมื่อไม่มี/ว่าง', () => {
    expect(parseBookingRoomId('  room-s  ')).toBe('room-s')
    expect(parseBookingRoomId(['room-g', 'room-s'])).toBe('room-g')
    expect(parseBookingRoomId(undefined)).toBeNull()
    expect(parseBookingRoomId('   ')).toBeNull()
  })
})

describe('href builders', () => {
  it('สร้างลิงก์เลือกวันของห้องด้วย ?date= และ ?room=', () => {
    expect(bookingRoomHref('/user/booking', 'room-s', '2026-10-20')).toBe(
      '/user/booking?date=2026-10-20&room=room-s',
    )
  })

  it('สร้างลิงก์สลับวันด้วย ?date= เดียว', () => {
    expect(bookingDayHref('/admin/booking', '2026-10-20')).toBe(
      '/admin/booking?date=2026-10-20',
    )
  })
})
