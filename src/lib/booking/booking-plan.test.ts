import { describe, expect, it } from 'vitest'

import { meetsMinDuration, planBooking } from './booking-plan'

/**
 * การรวม/แยก record ของการจองหลายบล็อก (TOR ข้อ 6.1)
 * - บล็อกติดกัน (end == start ของบล็อกถัดไป) → รวมเป็น 1 record
 * - บล็อกที่มีช่องว่าง → แยก record → ต้องยืนยันกับเจ้าหน้าที่หลายครั้ง
 * ตรรกะล้วน ไม่ขึ้นกับ React/DB — ใช้ทั้งฝั่ง UI (สรุปก่อนยืนยัน) และฝั่ง server (ตัดสินใจบันทึก)
 */

const block = (start: string, end: string) => ({ start, end })

describe('planBooking', () => {
  it('ยังไม่เลือกบล็อก: ไม่มี record และไม่ต้องยืนยันกับเจ้าหน้าที่เลย', () => {
    expect(planBooking([])).toEqual({
      records: [],
      confirmationCount: 0,
      totalMinutes: 0,
    })
  })

  it('บล็อกติดกัน 2 บล็อก: รวมเป็น 1 record (08:30–09:30 + 09:30–10:30 → 08:30–10:30)', () => {
    const plan = planBooking([block('08:30', '09:30'), block('09:30', '10:30')])

    expect(plan.records).toEqual([{ start: '08:30', end: '10:30', minutes: 120 }])
    expect(plan.confirmationCount).toBe(1)
    expect(plan.totalMinutes).toBe(120)
  })

  it('บล็อกที่มีช่องว่าง: แยกเป็น 2 record (08:30–09:30 + 10:30–11:30) → ยืนยัน 2 ครั้ง', () => {
    const plan = planBooking([block('08:30', '09:30'), block('10:30', '11:30')])

    expect(plan.records).toEqual([
      { start: '08:30', end: '09:30', minutes: 60 },
      { start: '10:30', end: '11:30', minutes: 60 },
    ])
    expect(plan.confirmationCount).toBe(2)
    expect(plan.totalMinutes).toBe(120)
  })

  it('เลือกสลับลำดับมา: เรียงตามเวลาแล้วจึงตัดสินใจรวม/แยก', () => {
    const plan = planBooking([
      block('13:30', '14:30'),
      block('08:30', '09:30'),
      block('09:30', '10:30'),
    ])

    expect(plan.records.map((record) => `${record.start}-${record.end}`)).toEqual([
      '08:30-10:30',
      '13:30-14:30',
    ])
    expect(plan.confirmationCount).toBe(2)
  })

  it('บล็อกติดกันหลายบล็อก: รวมเป็น record เดียวยาวตามจำนวนบล็อก', () => {
    const plan = planBooking([
      block('13:30', '14:30'),
      block('14:30', '15:30'),
      block('15:30', '16:30'),
    ])

    expect(plan.records).toEqual([{ start: '13:30', end: '16:30', minutes: 180 }])
    expect(plan.confirmationCount).toBe(1)
    expect(plan.totalMinutes).toBe(180)
  })

  it('บล็อกเดียว: 1 record ตามที่เลือก', () => {
    expect(planBooking([block('09:30', '10:30')])).toEqual({
      records: [{ start: '09:30', end: '10:30', minutes: 60 }],
      confirmationCount: 1,
      totalMinutes: 60,
    })
  })
})

describe('meetsMinDuration', () => {
  it('ไม่มี record เลย: ไม่ผ่านระยะเวลาขั้นต่ำ', () => {
    expect(meetsMinDuration(planBooking([]), 60)).toBe(false)
  })

  it('ห้อง G (อย่างน้อย 120 นาที): record 60 นาทีไม่ผ่าน, record 120 นาทีผ่าน', () => {
    expect(meetsMinDuration(planBooking([block('08:30', '09:30')]), 120)).toBe(false)
    expect(
      meetsMinDuration(planBooking([block('08:30', '09:30'), block('09:30', '10:30')]), 120),
    ).toBe(true)
  })

  it('ห้อง S/P (อย่างน้อย 60 นาที): 1 บล็อกผ่าน', () => {
    expect(meetsMinDuration(planBooking([block('08:30', '09:30')]), 60)).toBe(true)
  })

  it('มี record ใดต่ำกว่าขั้นต่ำ: ไม่ผ่านทั้งชุด แม้ record อื่นจะยาวพอ', () => {
    const plan = planBooking([
      block('08:30', '09:30'), // 60 นาที — ต่ำกว่า 120
      block('10:30', '11:30'),
      block('11:30', '12:30'), // 120 นาที — ผ่าน
    ])

    expect(meetsMinDuration(plan, 120)).toBe(false)
  })
})
