import { describe, expect, it } from 'vitest'

import {
  exclusionConstraintName,
  exclusionViolationMessage,
  pgErrorCode,
  pgErrorMessage,
} from './pg-error'

describe('pgErrorCode', () => {
  it('อ่านรหัส SQLSTATE ที่ติดมากับ error โดยตรง', () => {
    expect(pgErrorCode(Object.assign(new Error('duplicate'), { code: '23505' }))).toBe('23505')
  })

  it('อ่านรหัสจาก cause ที่ Drizzle ห่อไว้ (DrizzleQueryError)', () => {
    const cause = Object.assign(new Error('still has active rooms'), { code: '23001' })
    const wrapped = new Error('Failed query', { cause })

    expect(pgErrorCode(wrapped)).toBe('23001')
  })

  it('คืน null เมื่อ error ไม่มีรหัสหรือไม่ใช่ error', () => {
    expect(pgErrorCode(new Error('boom'))).toBeNull()
    expect(pgErrorCode(null)).toBeNull()
    expect(pgErrorCode('23505')).toBeNull()
  })
})

describe('pgErrorMessage', () => {
  it('อ่านข้อความที่ติดมากับ error โดยตรง', () => {
    expect(pgErrorMessage(new Error('conflicting key value'))).toBe('conflicting key value')
  })

  it('อ่านข้อความจาก cause ที่ Drizzle ห่อไว้เมื่อ error นอกไม่มีข้อความ', () => {
    const cause = new Error('violates exclusion constraint "reservation_room_exclusive"')
    const wrapped = new Error('Failed query: ...', { cause })

    // wrapped มีข้อความของตัวเอง — คืนของ direct ก่อน เพื่อให้ผู้เรียกตัดสินใจไล่ cause ต่อเอง
    expect(pgErrorMessage(wrapped)).toBe('Failed query: ...')
    expect(pgErrorMessage(cause)).toContain('reservation_room_exclusive')
  })

  it('คืน null เมื่อ error ไม่มีข้อความหรือไม่ใช่ error', () => {
    expect(pgErrorMessage(null)).toBeNull()
    expect(pgErrorMessage({ code: '23505' })).toBeNull()
    expect(pgErrorMessage({ message: 123 })).toBeNull()
  })
})

/** สร้าง pg error ที่ Drizzle ห่อไว้ (ข้อความนอกเป็นของ Drizzle ข้อความในเป็นของ pg) */
function wrappedPgError(pgMessage: string): Error {
  return new Error('Failed query: INSERT INTO "reservation"', { cause: new Error(pgMessage) })
}

describe('exclusionConstraintName', () => {
  it('แกะชื่อ constraint จากข้อความของ exclusion violation', () => {
    expect(
      exclusionConstraintName(
        new Error('conflicting key value violates exclusion constraint "reservation_room_exclusive", key ...'),
      ),
    ).toBe('reservation_room_exclusive')
  })

  it('แกะชื่อ constraint จาก cause เมื่อข้อความนอกเป็นของ Drizzle (ไม่มีชื่อ constraint)', () => {
    expect(
      exclusionConstraintName(
        wrappedPgError('conflicting key value violates exclusion constraint "reservation_user_no_overlap", key'),
      ),
    ).toBe('reservation_user_no_overlap')
  })

  it('คืน null เมื่อข้อความไม่มีชื่อ constraint', () => {
    expect(exclusionConstraintName(new Error('some other error'))).toBeNull()
    expect(exclusionConstraintName(null)).toBeNull()
  })
})

describe('exclusionViolationMessage', () => {
  const messages = {
    reservation_room_exclusive: 'ห้องถูกจองไปแล้ว',
    reservation_user_no_overlap: 'คุณมีการจองทับซ้อนอยู่แล้ว',
  }

  it('คืนข้อความตามชื่อ constraint เมื่อรหัสเป็น 23P01', () => {
    const roomTaken = wrappedPgError(
      'conflicting key value violates exclusion constraint "reservation_room_exclusive", key',
    )
    Object.assign(roomTaken.cause as object, { code: '23P01' })

    expect(exclusionViolationMessage(roomTaken, messages)).toBe('ห้องถูกจองไปแล้ว')
  })

  it('คืน null เมื่อรหัสไม่ใช่ 23P01 แม้ข้อความดูเหมือน exclusion', () => {
    const other = wrappedPgError(
      'conflicting key value violates exclusion constraint "reservation_room_exclusive", key',
    )
    Object.assign(other.cause as object, { code: '23505' })

    expect(exclusionViolationMessage(other, messages)).toBeNull()
  })

  it('คืน null เมื่อ constraint ไม่อยู่ในตารางข้อความ', () => {
    const unknown = wrappedPgError(
      'conflicting key value violates exclusion constraint "some_other_constraint", key',
    )
    Object.assign(unknown.cause as object, { code: '23P01' })

    expect(exclusionViolationMessage(unknown, messages)).toBeNull()
  })
})
