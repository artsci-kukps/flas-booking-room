import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireAdminMock, changeUserRoleMock, setUserBlockedMock, revalidatePathMock } =
  vi.hoisted(() => ({
    requireAdminMock: vi.fn(),
    changeUserRoleMock: vi.fn(),
    setUserBlockedMock: vi.fn(),
    revalidatePathMock: vi.fn(),
  }))

vi.mock('@/lib/auth/guards', () => ({ requireAdmin: requireAdminMock }))
vi.mock('@/lib/admin/users', () => ({
  changeUserRole: changeUserRoleMock,
  setUserBlocked: setUserBlockedMock,
}))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))

import { updateUserBlocked, updateUserRole } from './actions'

const ADMIN = {
  id: 'a1',
  email: 'admin@ku.th',
  fullName: 'ผู้ดูแล ระบบ',
  imageUrl: null,
  role: 'admin' as const,
  isBlocked: false,
}

function form(entries: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value)
  }
  return data
}

describe('updateUserRole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminMock.mockResolvedValue(ADMIN)
    changeUserRoleMock.mockResolvedValue({ ok: true })
  })

  it('ตรวจสิทธิ์แอดมินก่อนทุกครั้ง', async () => {
    await updateUserRole(null, form({ targetId: 'u1', role: 'admin' }))

    expect(requireAdminMock).toHaveBeenCalledTimes(1)
  })

  it('ปฏิเสธบทบาทที่ไม่รู้จักโดยไม่แตะชั้นข้อมูล', async () => {
    const result = await updateUserRole(null, form({ targetId: 'u1', role: 'superuser' }))

    expect(result).toMatchObject({ ok: false })
    expect(changeUserRoleMock).not.toHaveBeenCalled()
  })

  it('ส่งต่อเป้าหมายและบทบาทใหม่ให้ชั้นข้อมูล แล้วรีเฟรชหน้ารายชื่อ', async () => {
    const result = await updateUserRole(null, form({ targetId: 'u1', role: 'admin' }))

    expect(changeUserRoleMock).toHaveBeenCalledWith('u1', 'admin')
    expect(result).toEqual({ ok: true })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/users')
  })

  it('คืนข้อความจากชั้นข้อมูลและไม่รีเฟรชเมื่อถูกกัน lock-out', async () => {
    changeUserRoleMock.mockResolvedValue({ ok: false, message: 'เหลือแอดมินสุดท้าย' })

    const result = await updateUserRole(null, form({ targetId: 'a1', role: 'user' }))

    expect(result).toEqual({ ok: false, message: 'เหลือแอดมินสุดท้าย' })
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})

describe('updateUserBlocked', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminMock.mockResolvedValue(ADMIN)
    setUserBlockedMock.mockResolvedValue({ ok: true })
  })

  it('ระงับบัญชีโดยใช้ id ของแอดมินผู้ดำเนินการ', async () => {
    const result = await updateUserBlocked(null, form({ targetId: 'u1', blocked: 'true' }))

    expect(setUserBlockedMock).toHaveBeenCalledWith('a1', 'u1', true)
    expect(result).toEqual({ ok: true })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/users')
  })

  it('ปลดระงับบัญชี', async () => {
    await updateUserBlocked(null, form({ targetId: 'u1', blocked: 'false' }))

    expect(setUserBlockedMock).toHaveBeenCalledWith('a1', 'u1', false)
  })

  it('ปฏิเสธค่าสถานะที่ไม่ถูกต้อง', async () => {
    const result = await updateUserBlocked(null, form({ targetId: 'u1', blocked: 'maybe' }))

    expect(result).toMatchObject({ ok: false })
    expect(setUserBlockedMock).not.toHaveBeenCalled()
  })
})
