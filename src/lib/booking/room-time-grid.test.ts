import { describe, expect, it } from 'vitest'

import type { SlotRange } from './day-availability'
import { buildRoomTimeAxis } from './room-time-grid'

/**
 * แกนเวลาของตารางห้อง × เวลา — ห้องแต่ละประเภทมีบล็อกยาวไม่เท่ากัน (S/P = 60 นาที, G = 120)
 * ตารางจึงใช้คอลัมน์กว้างเท่าหหารร่วมมาก (GCD) ของบล็อกทั้งหมด แล้วให้บล็อกของห้องครอบ span
 * ตามความยาวจริง — ช่องทุกห้องเริ่มที่เวลาเปิดเดียวกัน (buildDaySlots) จึงตรงแนวเสมอ
 */

/** สร้างช่องว่างต่อเนื่องจากเวลาเปิด เช่น slots('08:30', 60, 3) = 08:30–09:30, 09:30–10:30, 10:30–11:30 */
function slots(openMinutes: number, blockMinutes: number, count: number): SlotRange[] {
  return Array.from({ length: count }, (_, i) => ({
    start: hhmm(openMinutes + i * blockMinutes),
    end: hhmm(openMinutes + i * blockMinutes + blockMinutes),
  }))
}

function hhmm(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const OPEN_0830 = 8 * 60 + 30

describe('buildRoomTimeAxis', () => {
  it('ห้อง S บล็อก 60 + ห้อง G บล็อก 120 → คอลัมน์กว้าง 60 นาที นับรวมทั้งวัน', () => {
    // เปิด 08:30–16:30: S = 8 บล็อก, G = 4 บล็อก (บล็อกละ 2 ชม.)
    const axis = buildRoomTimeAxis([
      { slots: slots(OPEN_0830, 60, 8) },
      { slots: slots(OPEN_0830, 120, 4) },
    ])

    expect(axis).not.toBeNull()
    expect(axis!.unit).toBe(60)
    expect(axis!.columns).toBe(8)
    expect(axis!.labels).toEqual([
      '08:30',
      '09:30',
      '10:30',
      '11:30',
      '12:30',
      '13:30',
      '14:30',
      '15:30',
    ])
    expect(axis!.spanOf({ start: '08:30', end: '09:30' })).toBe(1)
    expect(axis!.spanOf({ start: '08:30', end: '10:30' })).toBe(2)
  })

  it('มีแค่ห้อง G (บล็อก 120) → คอลัมน์กว้าง 120 นาที ป้ายหัวเป็นต้นบล็อก', () => {
    const axis = buildRoomTimeAxis([{ slots: slots(OPEN_0830, 120, 4) }])

    expect(axis!.unit).toBe(120)
    expect(axis!.columns).toBe(4)
    expect(axis!.labels).toEqual(['08:30', '10:30', '12:30', '14:30'])
    expect(axis!.spanOf({ start: '10:30', end: '12:30' })).toBe(1)
  })

  it('ห้องที่เลิกก่อนห้องอื่น: คอลัมน์เท่ากับห้องที่กินเวลานานสุด (แถวสั้นกว่ามีท้ายแถวว่าง)', () => {
    // เปิด 08:00–17:00: S = 9 บล็อก (จบ 17:00), G = 4 บล็อก (จบ 16:00 → เหลือท้ายแถว 1 ช่วง)
    const open = 8 * 60
    const axis = buildRoomTimeAxis([
      { slots: slots(open, 60, 9) },
      { slots: slots(open, 120, 4) },
    ])

    expect(axis!.columns).toBe(9)
    expect(axis!.labels[8]).toBe('16:00')

    const roomG = { slots: slots(open, 120, 4) }
    const consumed = roomG.slots.reduce((sum, slot) => sum + axis!.spanOf(slot), 0)
    expect(axis!.columns - consumed).toBe(1) // แถว G ว่างท้ายแถว 1 คอลัมน์
  })

  it('ไม่มีช่องว่างเลย (วันไม่มีเวลาให้บริการ) → คืน null เพื่อให้หน้าจอแจ้งแทน', () => {
    expect(buildRoomTimeAxis([])).toBeNull()
    expect(buildRoomTimeAxis([{ slots: [] }, { slots: [] }])).toBeNull()
  })
})
