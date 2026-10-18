import { describe, expect, it } from 'vitest'

import type { RoomSlotView } from './day-availability'

import { toggleSlotSelection, type SlotSelection } from './slot-selection'

/**
 * ตรรกะการเลือกช่องว่างหลายบล็อกของผู้ใช้ (TOR ข้อ 6.1)
 * - เลือกได้หลายบล็อก แต่ของ "ห้องเดียวกันเท่านั้น" ต่อการจองหนึ่งครั้ง (ต้องยืนยันทีละห้อง)
 * - กดช่องเดิมซ้ำ = ยกเลิกบล็อกนั้น; กดช่องของห้องอื่น = เริ่มเลือกใหม่เฉพาะห้องนั้น
 * ช่องที่เลือกไม่ได้ (ผ่านไปแล้ว/ถูกบล็อก/เต็ม) ถูก disabled ที่ UI แล้ว — ที่นี่เป็นแนวป้องกันชั้นที่สอง
 */

const ROOM = { id: 'room-s', name: 'S-101' }
const ROOM_G = { id: 'room-g', name: 'G-101' }

function slot(overrides: Partial<RoomSlotView> = {}): RoomSlotView {
  return {
    start: '09:30',
    end: '10:30',
    status: 'free',
    usedCount: 0,
    past: false,
    selectable: true,
    ...overrides,
  }
}

function selected(blocks: { start: string; end: string }[]): SlotSelection {
  return { roomId: 'room-s', roomName: 'S-101', blocks }
}

describe('toggleSlotSelection', () => {
  it('ยังไม่ได้เลือก: กดช่องที่เลือกได้ = เลือกบล็อกนั้น', () => {
    expect(toggleSlotSelection(null, ROOM, slot())).toEqual(
      selected([{ start: '09:30', end: '10:30' }]),
    )
  })

  it('กดช่องอื่นของห้องเดียวกัน = เพิ่มบล็อก (เลือกหลายบล็อกได้)', () => {
    const current = selected([{ start: '09:30', end: '10:30' }])

    expect(toggleSlotSelection(current, ROOM, slot({ start: '10:30', end: '11:30' }))).toEqual(
      selected([
        { start: '09:30', end: '10:30' },
        { start: '10:30', end: '11:30' },
      ]),
    )
  })

  it('กดช่องเดิมซ้ำ = ยกเลิกบล็อกนั้น และคงบล็อกอื่นไว้', () => {
    const current = selected([
      { start: '09:30', end: '10:30' },
      { start: '10:30', end: '11:30' },
    ])

    expect(toggleSlotSelection(current, ROOM, slot())).toEqual(
      selected([{ start: '10:30', end: '11:30' }]),
    )
  })

  it('ยกเลิกบล็อกสุดท้าย = ไม่เหลือการเลือก (null)', () => {
    const current = selected([{ start: '09:30', end: '10:30' }])

    expect(toggleSlotSelection(current, ROOM, slot())).toBeNull()
  })

  it('เรียงบล็อกตามเวลาเสมอ แม้กดจากช่องท้ายไปต้น', () => {
    const current = selected([{ start: '10:30', end: '11:30' }])

    expect(toggleSlotSelection(current, ROOM, slot())).toEqual(
      selected([
        { start: '09:30', end: '10:30' },
        { start: '10:30', end: '11:30' },
      ]),
    )
  })

  it('กดช่องของห้องอื่น = เริ่มเลือกใหม่เฉพาะห้องนั้น (ข้ามห้องในหนึ่งการจองไม่ได้)', () => {
    const current = selected([{ start: '09:30', end: '10:30' }])

    expect(toggleSlotSelection(current, ROOM_G, slot({ start: '13:30', end: '14:30' }))).toEqual({
      roomId: 'room-g',
      roomName: 'G-101',
      blocks: [{ start: '13:30', end: '14:30' }],
    })
  })

  it('ช่องที่เลือกไม่ได้ (ติดขอบเดิมของ disabled) ไม่แตะสถานะการเลือก', () => {
    const current = selected([{ start: '09:30', end: '10:30' }])

    expect(toggleSlotSelection(current, ROOM_G, slot({ selectable: false }))).toBe(current)
    expect(toggleSlotSelection(null, ROOM_G, slot({ past: true, selectable: false }))).toBeNull()
  })
})
