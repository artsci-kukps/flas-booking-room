import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  insertMock,
  selectMock,
  valuesMock,
  returningMock,
  limitMock,
  signInWithPasswordMock,
  createUserMock,
  getRedisMock,
  setRedisMock,
  delRedisMock,
  incrRedisMock,
  ttlRedisMock,
  sendEmailMock,
  redirectMock,
} = vi.hoisted(() => {
  const returningMock = vi.fn()
  const onConflictMock = vi.fn(() => ({ returning: returningMock }))
  const valuesMock = vi.fn(() => ({ onConflictDoUpdate: onConflictMock }))
  const insertMock = vi.fn(() => ({ values: valuesMock }))

  const limitMock = vi.fn()
  const whereMock = vi.fn(() => ({ limit: limitMock }))
  const fromMock = vi.fn(() => ({ where: whereMock }))
  const selectMock = vi.fn(() => ({ from: fromMock }))

  // redirect() ของจริงขว้าง error เพื่อหยุดการทำงาน — เลียนแบบให้ตรง
  const redirectMock = vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  })

  return {
    insertMock,
    selectMock,
    valuesMock,
    returningMock,
    limitMock,
    signInWithPasswordMock: vi.fn(),
    createUserMock: vi.fn(),
    getRedisMock: vi.fn(),
    setRedisMock: vi.fn(),
    delRedisMock: vi.fn(),
    incrRedisMock: vi.fn(),
    ttlRedisMock: vi.fn(),
    sendEmailMock: vi.fn(),
    redirectMock,
  }
})

vi.mock('@/db', () => ({ default: { insert: insertMock, select: selectMock } }))
vi.mock('@/app/config/supabase-server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { signInWithPassword: signInWithPasswordMock },
  })),
}))
vi.mock('@/app/config/supabase-admin', () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    auth: { admin: { createUser: createUserMock } },
  })),
}))
vi.mock('@/services/redis.service', () => ({
  getRedis: getRedisMock,
  setRedis: setRedisMock,
  delRedis: delRedisMock,
  incrRedis: incrRedisMock,
  ttlRedis: ttlRedisMock,
}))
vi.mock('@/services/email.service', () => ({ sendEmail: sendEmailMock }))
vi.mock('next/navigation', () => ({ redirect: redirectMock }))

import { hashOtp } from '@/lib/auth/otp-crypto'
import {
  requestOTPforRegister,
  signInWithEmailAndPassword,
  signUpWithEmailAndPassword,
} from './action'

const KU_EMAIL = 'user@ku.th'

describe('signInWithEmailAndPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: 'u1', email: KU_EMAIL, user_metadata: {} } },
      error: null,
    })
    returningMock.mockResolvedValue([{ role: 'user' }])
  })

  it('ปฏิเสธอีเมลนอกโดเมนโดยไม่แตะ Supabase', async () => {
    const result = await signInWithEmailAndPassword({
      email: 'user@gmail.com',
      password: 'secret123',
    })

    expect(result).toMatchObject({ ok: false, error: { field: 'email' } })
    expect(signInWithPasswordMock).not.toHaveBeenCalled()
  })

  it('เตือนเมื่อไม่ได้กรอกรหัสผ่าน', async () => {
    const result = await signInWithEmailAndPassword({
      email: KU_EMAIL,
      password: '',
    })

    expect(result).toMatchObject({ ok: false, error: { field: 'password' } })
    expect(signInWithPasswordMock).not.toHaveBeenCalled()
  })

  it('แสดงข้อความกลาง ๆ เมื่ออีเมลหรือรหัสผ่านไม่ถูกต้อง', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    })

    const result = await signInWithEmailAndPassword({
      email: KU_EMAIL,
      password: 'wrongpass',
    })

    expect(result).toMatchObject({
      ok: false,
      error: { heading: 'เข้าสู่ระบบไม่สำเร็จ', field: 'password' },
    })
    expect(valuesMock).not.toHaveBeenCalled()
  })

  it('เข้าสู่ระบบสำเร็จ: normalize อีเมล บันทึก lastLoginAt แล้วไปหน้าจองห้อง', async () => {
    await expect(
      signInWithEmailAndPassword({ email: ' User@KU.TH ', password: 'secret123' }),
    ).rejects.toThrow('NEXT_REDIRECT:/user/booking')

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: KU_EMAIL,
      password: 'secret123',
    })
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'u1',
        email: KU_EMAIL,
        lastLoginAt: expect.any(Date),
      }),
    )
  })

  it('พาแอดมินไปแดชบอร์ดของแอดมิน', async () => {
    returningMock.mockResolvedValue([{ role: 'admin' }])

    await expect(
      signInWithEmailAndPassword({ email: KU_EMAIL, password: 'secret123' }),
    ).rejects.toThrow('NEXT_REDIRECT:/admin/dashboard')
  })
})

describe('requestOTPforRegister', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    limitMock.mockResolvedValue([])
    getRedisMock.mockResolvedValue(null)
    incrRedisMock.mockResolvedValue(1)
    ttlRedisMock.mockResolvedValue(-2)
    setRedisMock.mockResolvedValue(undefined)
    delRedisMock.mockResolvedValue(undefined)
    sendEmailMock.mockResolvedValue(undefined)
  })

  it('ปฏิเสธอีเมลนอกโดเมนก่อนส่งอีเมล', async () => {
    const result = await requestOTPforRegister('user@gmail.com')

    expect(result).toMatchObject({ ok: false, error: { field: 'email' } })
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it('ไม่ส่งรหัสซ้ำถ้าอีเมลนี้มีบัญชีอยู่แล้ว', async () => {
    limitMock.mockResolvedValue([{ id: 'u1' }])

    const result = await requestOTPforRegister(KU_EMAIL)

    expect(result).toMatchObject({
      ok: false,
      error: { heading: 'อีเมลนี้มีบัญชีอยู่แล้ว' },
    })
    expect(sendEmailMock).not.toHaveBeenCalled()
    expect(setRedisMock).not.toHaveBeenCalled()
  })

  it('เคารพคูลดาวน์และบอกเวลาที่ต้องรอ', async () => {
    ttlRedisMock.mockResolvedValue(42)

    const result = await requestOTPforRegister(KU_EMAIL)

    expect(result).toMatchObject({
      ok: false,
      error: { heading: 'ยังขอรหัสซ้ำไม่ได้' },
    })
    expect(JSON.stringify(result)).toContain('0:42')
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it('หยุดเมื่อขอรหัสเกินเพดานต่อชั่วโมง', async () => {
    incrRedisMock.mockResolvedValue(6)

    const result = await requestOTPforRegister(KU_EMAIL)

    expect(result).toMatchObject({
      ok: false,
      error: { heading: 'ขอรหัสบ่อยเกินไป' },
    })
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it('ส่งรหัสสำเร็จ: เก็บเฉพาะแฮช + ตั้งคูลดาวน์ + ส่งอีเมลจริง', async () => {
    const result = await requestOTPforRegister(' New@KU.TH ')

    expect(result).toEqual({ ok: true })

    const [otpKey, payload, ttl] = setRedisMock.mock.calls[0]
    expect(otpKey).toBe('register:new@ku.th:otp')
    expect(ttl).toBe(600)
    expect(payload).toMatchObject({ attempts: 0 })
    expect(payload.hash).toMatch(/^[0-9a-f]{64}$/)

    expect(setRedisMock).toHaveBeenCalledWith(
      'register:new@ku.th:otp:cooldown',
      true,
      60,
    )
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    expect(sendEmailMock.mock.calls[0][0]).toMatchObject({ to: 'new@ku.th' })
    expect(sendEmailMock.mock.calls[0][0].subject).toContain('ยืนยัน')
  })

  it('ล้างรหัสและคูลดาวน์เมื่อส่งอีเมลไม่สำเร็จ', async () => {
    sendEmailMock.mockRejectedValue(new Error('smtp down'))

    const result = await requestOTPforRegister(KU_EMAIL)

    expect(result).toMatchObject({
      ok: false,
      error: { heading: 'ส่งรหัสไม่สำเร็จ' },
    })
    expect(delRedisMock).toHaveBeenCalledWith('register:user@ku.th:otp')
    expect(delRedisMock).toHaveBeenCalledWith('register:user@ku.th:otp:cooldown')
  })
})

describe('signUpWithEmailAndPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getRedisMock.mockResolvedValue({ hash: hashOtp('123456'), attempts: 0 })
    setRedisMock.mockResolvedValue(undefined)
    delRedisMock.mockResolvedValue(undefined)
    ttlRedisMock.mockResolvedValue(300)
    createUserMock.mockResolvedValue({ data: { user: { id: 'new1' } }, error: null })
    signInWithPasswordMock.mockResolvedValue({ data: { user: { id: 'new1' } }, error: null })
    returningMock.mockResolvedValue([{ role: 'user' }])
    sendEmailMock.mockResolvedValue(undefined)
  })

  it('เตือนเรื่องรหัสผ่านสั้นก่อนแตะ Redis', async () => {
    const result = await signUpWithEmailAndPassword({
      email: 'new@ku.th',
      password: 'short',
      otp: '123456',
    })

    expect(result).toMatchObject({ ok: false, error: { field: 'password' } })
    expect(getRedisMock).not.toHaveBeenCalled()
  })

  it('บอกให้ขอรหัสใหม่เมื่อรหัสหมดอายุหรือถูกใช้ไปแล้ว', async () => {
    getRedisMock.mockResolvedValue(null)

    const result = await signUpWithEmailAndPassword({
      email: 'new@ku.th',
      password: 'secret123',
      otp: '123456',
    })

    expect(result).toMatchObject({
      ok: false,
      error: { heading: 'รหัสยืนยันใช้ไม่ได้แล้ว', field: 'otp' },
    })
    expect(createUserMock).not.toHaveBeenCalled()
  })

  it('นับจำนวนครั้งที่กรอกผิดและไม่สร้างบัญชี', async () => {
    const result = await signUpWithEmailAndPassword({
      email: 'new@ku.th',
      password: 'secret123',
      otp: '000000',
    })

    expect(result).toMatchObject({ ok: false, error: { field: 'otp' } })
    expect(setRedisMock).toHaveBeenCalledWith(
      'register:new@ku.th:otp',
      { hash: hashOtp('123456'), attempts: 1 },
      300,
    )
    expect(createUserMock).not.toHaveBeenCalled()
  })

  it('ล้างรหัสเมื่อกรอกผิดครบจำนวนครั้งที่อนุญาต', async () => {
    getRedisMock.mockResolvedValue({ hash: hashOtp('123456'), attempts: 4 })

    const result = await signUpWithEmailAndPassword({
      email: 'new@ku.th',
      password: 'secret123',
      otp: '000000',
    })

    expect(result).toMatchObject({
      ok: false,
      error: { heading: 'รหัสไม่ถูกต้องหลายครั้ง' },
    })
    expect(delRedisMock).toHaveBeenCalledWith('register:new@ku.th:otp')
    expect(createUserMock).not.toHaveBeenCalled()
  })

  it('แจ้งอย่างเป็นมิตรเมื่อ Supabase บอกว่าอีเมลซ้ำ', async () => {
    createUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: 'A user with this email address has already been registered' },
    })

    const result = await signUpWithEmailAndPassword({
      email: 'new@ku.th',
      password: 'secret123',
      otp: '123456',
    })

    expect(result).toMatchObject({
      ok: false,
      error: { heading: 'สมัครสมาชิกไม่สำเร็จ' },
    })
    expect(JSON.stringify(result)).toContain('เข้าสู่ระบบ')
  })

  it('สมัครสำเร็จ: ยืนยันอีเมลที่ Supabase ล้างรหัส บันทึกผู้ใช้ แล้วเข้าสู่ระบบให้เลย', async () => {
    await expect(
      signUpWithEmailAndPassword({
        email: ' New@KU.TH ',
        password: 'secret123',
        otp: '123456',
      }),
    ).rejects.toThrow('NEXT_REDIRECT:/user/booking')

    expect(createUserMock).toHaveBeenCalledWith({
      email: 'new@ku.th',
      password: 'secret123',
      email_confirm: true,
    })
    expect(delRedisMock).toHaveBeenCalledWith('register:new@ku.th:otp')
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new1', email: 'new@ku.th' }),
    )
    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: 'new@ku.th',
      password: 'secret123',
    })
  })

  it('ถ้าเข้าสู่ระบบอัตโนมัติล้มเหลว ให้กลับไปหน้าเข้าสู่ระบบพร้อมแจ้งข้อผิดพลาด', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: null },
      error: { message: 'unexpected' },
    })

    await expect(
      signUpWithEmailAndPassword({
        email: 'new@ku.th',
        password: 'secret123',
        otp: '123456',
      }),
    ).rejects.toThrow('NEXT_REDIRECT:/login?error=session')
  })
})
