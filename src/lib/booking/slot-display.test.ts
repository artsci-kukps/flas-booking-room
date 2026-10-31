import { describe, expect, it } from 'vitest'

import type { RoomSlotView } from './day-availability'

import {
  BLOCK_LENGTH_COPY,
  slotAriaLabel,
  slotChipClass,
  slotLengthLabel,
  slotStatusLabel,
} from './slot-display'

/** ช่องว่างตัวอย่าง: ว่าง 09:00–10:00 */
function makeSlot(overrides: Partial<RoomSlotView> = {}): RoomSlotView {
  return {
    start: '09:00',
    end: '10:00',
    status: 'free',
    usedCount: 0,
    past: false,
    selectable: true,
    ...overrides,
  }
}

describe('slotStatusLabel', () => {
  it('ช่องว่างแสดง "ว่าง"', () => {
    expect(slotStatusLabel(makeSlot(), 'EXCLUSIVE', null)).toBe('ว่าง')
  })

  it('ห้อง EXCLUSIVE ที่มีการจองครองแสดง "ไม่ว่าง"', () => {
    expect(
      slotStatusLabel(makeSlot({ status: 'occupied', usedCount: 1, selectable: false }), 'EXCLUSIVE', null),
    ).toBe('ไม่ว่าง')
  })

  it('ห้อง CAPACITY แสดงจำนวนที่ใช้เทียบ max_capacity', () => {
    expect(
      slotStatusLabel(makeSlot({ status: 'occupied', usedCount: 2, selectable: true }), 'CAPACITY', 4),
    ).toBe('ไม่ว่าง 2/4')
  })

  it('ช่องที่ถูกบล็อกแสดง "ถูกบล็อก" แม้จะมีการจองซ้อนอยู่', () => {
    expect(
      slotStatusLabel(makeSlot({ status: 'blocked', usedCount: 1, selectable: false }), 'EXCLUSIVE', null),
    ).toBe('ถูกบล็อก')
  })

  it('ช่องที่ผ่านไปแล้วแสดง "ผ่านไปแล้ว"', () => {
    expect(
      slotStatusLabel(makeSlot({ past: true, selectable: false }), 'CAPACITY', 4),
    ).toBe('ผ่านไปแล้ว')
  })
})

describe('slotChipClass', () => {
  it('ว่างที่เลือกได้ใช้โทนเขียว KU พร้อม hover เต็มสี', () => {
    expect(slotChipClass(makeSlot())).toBe(
      'bg-ku-soft text-ku cursor-pointer hover:bg-ku hover:text-white',
    )
  })

  it('ไม่ว่างใช้โทน amber และให้ cursor เมื่อยังเลือกได้ (CAPACITY ยังไม่เต็ม)', () => {
    expect(
      slotChipClass(makeSlot({ status: 'occupied', usedCount: 1, selectable: true })),
    ).toBe('bg-amber-soft text-amber-ink cursor-pointer')
    expect(
      slotChipClass(makeSlot({ status: 'occupied', usedCount: 4, selectable: false })),
    ).toBe('bg-amber-soft text-amber-ink')
  })

  it('ถูกบล็อกและผ่านไปแล้วใช้โทนเงียบ ink-muted บนพื้น canvas', () => {
    expect(slotChipClass(makeSlot({ status: 'blocked', selectable: false }))).toBe(
      'bg-canvas text-ink-muted',
    )
    expect(slotChipClass(makeSlot({ past: true, selectable: false }))).toBe(
      'bg-canvas text-ink-muted',
    )
  })

  it('ไม่ส่งตัวเลือก clickable = ใช้ selectable ของช่องเป็นค่าเริ่มต้น', () => {
    expect(slotChipClass(makeSlot())).toBe(
      'bg-ku-soft text-ku cursor-pointer hover:bg-ku hover:text-white',
    )
    expect(slotChipClass(makeSlot({ selectable: false }))).toBe('bg-ku-soft text-ku')
  })

  it('ส่ง clickable: false = ตัด hover/cursor ของปุ่มออก แม้ช่องยัง selectable', () => {
    expect(slotChipClass(makeSlot(), { clickable: false })).toBe('bg-ku-soft text-ku')
    expect(
      slotChipClass(makeSlot({ status: 'occupied', usedCount: 2 }), { clickable: false }),
    ).toBe('bg-amber-soft text-amber-ink')
  })

  it('ส่ง clickable: true = ใช้คลาสแบบกดได้ แม้ช่องจะไม่ selectable', () => {
    expect(slotChipClass(makeSlot({ selectable: false }), { clickable: true })).toBe(
      'bg-ku-soft text-ku cursor-pointer hover:bg-ku hover:text-white',
    )
  })

  it('ช่องที่ผ่านไปแล้วหรือถูกบล็อกยังเงียบเสมอ ไม่ว่าจะส่ง clickable แบบไหน', () => {
    expect(slotChipClass(makeSlot({ status: 'blocked' }), { clickable: true })).toBe(
      'bg-canvas text-ink-muted',
    )
    expect(slotChipClass(makeSlot({ past: true }), { clickable: true })).toBe(
      'bg-canvas text-ink-muted',
    )
  })
})

describe('BLOCK_LENGTH_COPY', () => {
  it('บอกระยะเวลาขั้นต่ำตามประเภทห้อง และชี้ว่ายึดระยะเวลาขั้นต่ำของแต่ละประเภทห้อง', () => {
    expect(BLOCK_LENGTH_COPY).toContain('ห้องทั่วไป/ละหมาด จองขั้นต่ำครั้งละ 1 ชั่วโมง')
    expect(BLOCK_LENGTH_COPY).toContain('ห้องประชุมใหญ่ จองขั้นต่ำครั้งละ 2 ชั่วโมง')
    expect(BLOCK_LENGTH_COPY).toContain('ระยะเวลาขั้นต่ำของแต่ละประเภทห้อง')
  })
})

describe('slotLengthLabel', () => {
  it('แสดงความยาวบล็อกเป็นชั่วโมงเมื่อลงตัว', () => {
    expect(slotLengthLabel(60)).toBe('1 ชั่วโมง')
    expect(slotLengthLabel(120)).toBe('2 ชั่วโมง')
  })

  it('แสดงเป็นนาทีเมื่อไม่ลงตัวเป็นชั่วโมง', () => {
    expect(slotLengthLabel(90)).toBe('90 นาที')
  })
})

describe('slotAriaLabel', () => {
  it('ชื่อที่ screen reader อ่าน ประกอบด้วยเวลาและสถานะ', () => {
    expect(slotAriaLabel(makeSlot(), 'EXCLUSIVE', null)).toBe('09:00–10:00 น. ว่าง')
  })

  it('ช่องที่เลือกไม่ได้บอกเหตุผลกำกับ', () => {
    expect(
      slotAriaLabel(makeSlot({ past: true, selectable: false }), 'EXCLUSIVE', null),
    ).toContain('เวลาผ่านไปแล้ว')

    expect(
      slotAriaLabel(makeSlot({ status: 'blocked', selectable: false }), 'EXCLUSIVE', null),
    ).toContain('ห้องถูกบล็อก')

    expect(
      slotAriaLabel(makeSlot({ status: 'occupied', usedCount: 1, selectable: false }), 'EXCLUSIVE', null),
    ).toContain('มีผู้ใช้จองแล้ว')

    expect(
      slotAriaLabel(makeSlot({ status: 'occupied', usedCount: 4, selectable: false }), 'CAPACITY', 4),
    ).toContain('เต็มความจุ')
  })
})
