import { describe, expect, it } from 'vitest'

import { pgErrorCode } from './pg-error'

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
