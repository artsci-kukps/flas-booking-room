import { describe, expect, it } from 'vitest'

import type { RoomSlotView } from './day-availability'

import { toggleSlotSelection, type SlotSelection } from './slot-selection'

/**
 * ตรรกะการเลือกช่องว่าง 1 บล็อกของผู้ใช้ (TOR ข้อ 5.3: เลือกเป็นบล็อกเท่านั้น ห้ามพิมพ์เวลาเอง)
 * ปุ่มของช่องที่เลือกไม่ได้ (ว่าง/เต็ม/บล็อก/ผ่านไปแล้ว) ถูก disabled อยู่แล้วที่ UI
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

describe('toggleSlotSelection', () => {
  it('ยังไม่ได้เลือก: กดช่องที่เลือกได้ = เลือกช่องนั้น', () => {
    expect(toggleSlotSelection(null, ROOM, slot())).toEqual({
      roomId: 'room-s',
      roomName: 'S-101',
      start: '09:30',
      end: '10:30',
    })
  })

  it('กดช่องเดิมซ้ำ = ยกเลิกการเลือก', () => {
    const selected: SlotSelection = {
      roomId: 'room-s',
      roomName: 'S-101',
      start: '09:30',
      end: '10:30',
    }

    expect(toggleSlotSelection(selected, ROOM, slot())).toBeNull()
  })

  it('กดช่องอื่น (ห้องเดียวกันหรือห้องอื่น) = เลือกใหม่แทนที่อันเดิม (จองทีละบล็อก)', () => {
    const selected: SlotSelection = {
      roomId: 'room-s',
      roomName: 'S-101',
      start: '09:30',
      end: '10:30',
    }

    expect(toggleSlotSelection(selected, ROOM, slot({ start: '10:30', end: '11:30' }))).toMatchObject({
      start: '10:30',
      end: '11:30',
    })
    expect(toggleSlotSelection(selected, ROOM_G, slot())).toEqual({
      roomId: 'room-g',
      roomName: 'G-101',
      start: '09:30',
      end: '10:30',
    })
  })

  it('ช่องที่เลือกไม่ได้ (ติดขอบเดิมของ disabled) ไม่แตะสถานะการเลือก', () => {
    const selected: SlotSelection = {
      roomId: 'room-s',
      roomName: 'S-101',
      start: '09:30',
      end: '10:30',
    }

    expect(toggleSlotSelection(selected, ROOM_G, slot({ selectable: false }))).toBe(selected)
    expect(toggleSlotSelection(null, ROOM_G, slot({ past: true, selectable: false }))).toBeNull()
  })
})
