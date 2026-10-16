import { describe, expect, it } from 'vitest'

import { generateOtp, hashOtp, verifyOtp } from './otp-crypto'

describe('generateOtp', () => {
  it('คืนรหัสตัวเลขล้วนตามจำนวนหลักที่ขอ', () => {
    expect(generateOtp(6)).toMatch(/^\d{6}$/)
    expect(generateOtp(4)).toMatch(/^\d{4}$/)
  })

  it('คงหลักไว้แม้สุ่มได้เลขน้อย (padding ศูนย์นำหน้า)', () => {
    for (let index = 0; index < 50; index += 1) {
      expect(generateOtp(6)).toHaveLength(6)
    }
  })

  it('ไม่ซ้ำกันในการสุ่มติด ๆ กัน', () => {
    const codes = new Set(Array.from({ length: 30 }, () => generateOtp(6)))
    expect(codes.size).toBeGreaterThan(25)
  })
})

describe('hashOtp', () => {
  it('ให้ค่าเดิมเสมอสำหรับรหัสเดิม และเป็น sha256 hex', () => {
    expect(hashOtp('123456')).toBe(hashOtp('123456'))
    expect(hashOtp('123456')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('ให้ค่าต่างกันเมื่อรหัสต่างกัน', () => {
    expect(hashOtp('123456')).not.toBe(hashOtp('123457'))
  })
})

describe('verifyOtp', () => {
  it('ยอมรับเมื่อรหัสตรงกับแฮช', () => {
    expect(verifyOtp('654321', hashOtp('654321'))).toBe(true)
  })

  it('ปฏิเสธเมื่อรหัสไม่ตรง', () => {
    expect(verifyOtp('654321', hashOtp('654322'))).toBe(false)
  })

  it('ปฏิเสธเมื่อแฮชที่เก็บไว้เสียรูป', () => {
    expect(verifyOtp('654321', 'not-a-hash')).toBe(false)
  })
})
