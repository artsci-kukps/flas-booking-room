import { describe, expect, it } from 'vitest'

import { pgErrorCode, pgErrorMessage } from './pg-error'

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
