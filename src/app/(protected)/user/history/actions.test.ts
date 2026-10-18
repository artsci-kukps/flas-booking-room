import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireUserMock, cancelMyReservationMock, revalidatePathMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  cancelMyReservationMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}))

vi.mock('@/lib/auth/guards', () => ({ requireUser: requireUserMock }))
vi.mock('@/lib/booking/my-bookings', () => ({ cancelMyReservation: cancelMyReservationMock }))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))

import { cancelBooking } from './actions'

function form(entries: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value)
  }
  return data
}

const USER = {
  id: 'u1',
  email: 'somchai@ku.th',
  fullName: 'สมชาย ใจดี',
  imageUrl: null,
  role: 'user',
  isBlocked: false,
}

describe('cancelBooking action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireUserMock.mockResolvedValue(USER)
    cancelMyReservationMock.mockResolvedValue({ ok: true })
  })

  it('ตรวจสิทธิ์ผู้ใช้ และส่ง id กับ user id ของผู้เรียกไปยังชั้นยกเลิก', async () => {
    await cancelBooking(null, form({ id: 'res-1' }))

    expect(requireUserMock).toHaveBeenCalledTimes(1)
    expect(cancelMyReservationMock).toHaveBeenCalledWith('res-1', 'u1')
  })

  it('trim ค่าจากฟอร์ม', async () => {
    await cancelBooking(null, form({ id: '  res-1  ' }))

    expect(cancelMyReservationMock).toHaveBeenCalledWith('res-1', 'u1')
  })

  it('ยกเลิกสำเร็จ: รีเฟรชหน้าการจองของฉันและหน้าจอง แล้วคืนสถานะสำเร็จ', async () => {
    const state = await cancelBooking(null, form({ id: 'res-1' }))

    expect(state).toEqual({ ok: true })
    expect(revalidatePathMock).toHaveBeenCalledWith('/user/history')
    expect(revalidatePathMock).toHaveBeenCalledWith('/user/booking')
  })

  it('ชั้นยกเลิกปฏิเสธ: คืนข้อความภาษาไทยให้แสดง inline โดยไม่รีเฟรช', async () => {
    cancelMyReservationMock.mockResolvedValue({
      ok: false,
      message: 'การจองนี้กำลังใช้งานอยู่ ยกเลิกไม่ได้ — ต้องคืนกุญแจก่อน',
    })

    const state = await cancelBooking(null, form({ id: 'res-1' }))

    expect(state).toEqual({
      ok: false,
      message: 'การจองนี้กำลังใช้งานอยู่ ยกเลิกไม่ได้ — ต้องคืนกุญแจก่อน',
    })
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('ไม่ส่ง id มา: แจ้งให้รีเฟรช โดยไม่เรียกชั้นยกเลิก', async () => {
    const state = await cancelBooking(null, form({}))

    expect(state).toMatchObject({ ok: false })
    expect(cancelMyReservationMock).not.toHaveBeenCalled()
  })
})
