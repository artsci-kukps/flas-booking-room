import { describe, expect, it } from 'vitest'

import {
  authFail,
  emailProblem,
  formatCountdown,
  normaliseEmail,
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_SENDS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_SECONDS,
  otpRedisKeys,
  PASSWORD_MIN_LENGTH,
  passwordProblem,
} from './email-password'

describe('ค่าคงที่ของรหัส OTP และรหัสผ่าน', () => {
  it('ใช้รหัส 6 หลัก อายุ 10 นาที ตามที่ตกลงไว้', () => {
    expect(OTP_LENGTH).toBe(6)
    expect(OTP_TTL_SECONDS).toBe(600)
    expect(OTP_RESEND_COOLDOWN_SECONDS).toBe(60)
    expect(OTP_MAX_SENDS).toBe(5)
    expect(OTP_MAX_ATTEMPTS).toBe(5)
    expect(PASSWORD_MIN_LENGTH).toBe(8)
  })
})

describe('normaliseEmail', () => {
  it('ตัดช่องว่างหัวท้ายและลดเป็นตัวพิมพ์เล็ก', () => {
    expect(normaliseEmail('  User@KU.TH  ')).toBe('user@ku.th')
  })
})

describe('emailProblem', () => {
  it('เตือนเมื่อยังไม่กรอกอีเมล', () => {
    expect(emailProblem('')).toContain('กรุณากรอกอีเมล')
  })

  it('เตือนเมื่อรูปแบบอีเมลผิด', () => {
    expect(emailProblem('user@ku')).toContain('รูปแบบอีเมลไม่ถูกต้อง')
  })

  it('ปฏิเสธอีเมลนอกโดเมนมหาวิทยาลัย', () => {
    expect(emailProblem('user@gmail.com')).toContain('@ku.th')
  })

  it('ผ่านเมื่อเป็นอีเมลมหาวิทยาลัย', () => {
    expect(emailProblem('user@ku.th')).toBeNull()
  })
})

describe('passwordProblem', () => {
  it('เตือนเมื่อยังไม่กรอกรหัสผ่าน', () => {
    expect(passwordProblem('')).toContain('กรุณาตั้งรหัสผ่าน')
  })

  it('เตือนเมื่อรหัสผ่านสั้นกว่าเกณฑ์', () => {
    expect(passwordProblem('short12')).toContain('8 ตัวอักษร')
  })

  it('ผ่านเมื่อถึงความยาวขั้นต่ำ', () => {
    expect(passwordProblem('longenough')).toBeNull()
  })
})

describe('authFail', () => {
  it('คืนรูปผลลัพธ์แบบผิดพลาดพร้อมช่องที่ต้องโฟกัส', () => {
    expect(authFail('หัวข้อ', 'รายละเอียด', 'otp')).toEqual({
      ok: false,
      error: { heading: 'หัวข้อ', body: 'รายละเอียด', field: 'otp' },
    })
  })
})

describe('otpRedisKeys', () => {
  it('ให้คีย์ OTP/คูลดาวน์/ตัวนับ ที่อิงอีเมลเดียวกัน', () => {
    expect(otpRedisKeys('user@ku.th')).toEqual({
      otpKey: 'register:user@ku.th:otp',
      cooldownKey: 'register:user@ku.th:otp:cooldown',
      sendsKey: 'register:user@ku.th:otp:sends',
    })
  })
})

describe('formatCountdown', () => {
  it('แสดงเวลาถอยหลังแบบนาที:วินาที', () => {
    expect(formatCountdown(59)).toBe('0:59')
    expect(formatCountdown(60)).toBe('1:00')
    expect(formatCountdown(9)).toBe('0:09')
  })

  it('ไม่แสดงค่าติดลบ', () => {
    expect(formatCountdown(-5)).toBe('0:00')
  })
})
