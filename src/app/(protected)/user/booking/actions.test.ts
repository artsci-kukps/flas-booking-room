import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireUserMock, createReservationMock, revalidatePathMock, redirectMock } = vi.hoisted(
  () => ({
    requireUserMock: vi.fn(),
    createReservationMock: vi.fn(),
    revalidatePathMock: vi.fn(),
    redirectMock: vi.fn(),
  }),
)

vi.mock('@/lib/auth/guards', () => ({ requireUser: requireUserMock }))
vi.mock('@/lib/booking/reservations', () => ({ createReservation: createReservationMock }))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))
vi.mock('next/navigation', () => ({ redirect: redirectMock }))

import { bookRoom } from './actions'

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

const VALID_FORM = {
  roomId: 'room-s',
  date: '2026-10-19',
  startTime: '09:30',
  endTime: '10:30',
}

beforeEach(() => {
  vi.clearAllMocks()
  requireUserMock.mockResolvedValue(USER)
  createReservationMock.mockResolvedValue({ ok: true, bookingCode: '123456' })
})

describe('bookRoom action', () => {
  it('ตรวจสิทธิ์ผู้ใช้ก่อนทุกครั้ง และส่ง user id ของผู้เรียกไปยังชั้นจอง', async () => {
    await bookRoom(null, form(VALID_FORM))

    expect(requireUserMock).toHaveBeenCalledTimes(1)
    expect(createReservationMock).toHaveBeenCalledWith(
      { roomId: 'room-s', date: '2026-10-19', startTime: '09:30', endTime: '10:30' },
      'u1',
    )
  })

  it('จองสำเร็จ: รีเฟรชหน้าจอง แล้วพาไปหน้ายืนยันพร้อมรหัส 6 หลัก', async () => {
    await bookRoom(null, form(VALID_FORM))

    expect(revalidatePathMock).toHaveBeenCalledWith('/user/booking')
    expect(redirectMock).toHaveBeenCalledWith('/user/booking/confirmation?code=123456')
  })

  it('ชั้นจองปฏิเสธ: คืนข้อความภาษาไทยให้แสดง inline โดยไม่ redirect', async () => {
    createReservationMock.mockResolvedValue({
      ok: false,
      message: 'ช่วงเวลานี้มีผู้ใช้จองห้องนี้แล้ว กรุณาเลือกช่วงเวลาอื่น',
    })

    const state = await bookRoom(null, form(VALID_FORM))

    expect(state).toEqual({
      ok: false,
      message: 'ช่วงเวลานี้มีผู้ใช้จองห้องนี้แล้ว กรุณาเลือกช่วงเวลาอื่น',
    })
    expect(revalidatePathMock).not.toHaveBeenCalled()
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('trim ค่าจากฟอร์มและส่งต่อเป็นว่าง ๆ เมื่อไม่มีช่องใดถูกส่งมา', async () => {
    await bookRoom(null, form({ ...VALID_FORM, roomId: '  room-s  ' }))

    expect(createReservationMock).toHaveBeenCalledWith(
      { roomId: 'room-s', date: '2026-10-19', startTime: '09:30', endTime: '10:30' },
      'u1',
    )

    createReservationMock.mockClear()
    await bookRoom(null, form({}))

    expect(createReservationMock).toHaveBeenCalledWith(
      { roomId: '', date: '', startTime: '', endTime: '' },
      'u1',
    )
  })
})
