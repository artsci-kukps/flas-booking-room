import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireUserMock, submitBookingSelectionMock, revalidatePathMock, redirectMock } = vi.hoisted(
  () => ({
    requireUserMock: vi.fn(),
    submitBookingSelectionMock: vi.fn(),
    revalidatePathMock: vi.fn(),
    redirectMock: vi.fn(),
  }),
)

vi.mock('@/lib/auth/guards', () => ({ requireUser: requireUserMock }))
vi.mock('@/lib/booking/reservations', () => ({
  submitBookingSelection: submitBookingSelectionMock,
}))
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

const ADMIN = {
  ...USER,
  id: 'a1',
  role: 'admin',
}

const BLOCKS = [
  { start: '08:30', end: '09:30' },
  { start: '09:30', end: '10:30' },
]

const VALID_FORM = {
  roomId: 'room-s',
  date: '2026-10-19',
  blocks: JSON.stringify(BLOCKS),
}

beforeEach(() => {
  vi.clearAllMocks()
  requireUserMock.mockResolvedValue(USER)
  submitBookingSelectionMock.mockResolvedValue({ ok: true, bookingCodes: ['123456'] })
})

describe('bookRoom action', () => {
  it('ตรวจสิทธิ์ผู้ใช้ก่อนทุกครั้ง และส่งบล็อกที่เลือกพร้อม user id ไปยังชั้นจอง', async () => {
    await bookRoom(null, form(VALID_FORM))

    expect(requireUserMock).toHaveBeenCalledTimes(1)
    expect(submitBookingSelectionMock).toHaveBeenCalledWith(
      { roomId: 'room-s', date: '2026-10-19', blocks: BLOCKS },
      'u1',
    )
  })

  it('จองสำเร็จ record เดียว: รีเฟรชหน้าจอง แล้วพาไปหน้ายืนยันพร้อมรหัส', async () => {
    await bookRoom(null, form(VALID_FORM))

    expect(revalidatePathMock).toHaveBeenCalledWith('/user/booking')
    expect(redirectMock).toHaveBeenCalledWith('/user/booking/confirmation?code=123456')
  })

  it('แอดมินจองจากหน้าจองของแอดมิน: พาไปหน้ายืนยันของแอดมิน', async () => {
    requireUserMock.mockResolvedValue(ADMIN)

    await bookRoom(null, form(VALID_FORM))

    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/booking')
    expect(redirectMock).toHaveBeenCalledWith('/admin/booking/confirmation?code=123456')
  })

  it('จองสำเร็จหลาย record: ส่งรหัสทุก record ไปหน้ายืนยัน', async () => {
    submitBookingSelectionMock.mockResolvedValue({ ok: true, bookingCodes: ['111111', '222222'] })

    await bookRoom(null, form(VALID_FORM))

    expect(redirectMock).toHaveBeenCalledWith(
      '/user/booking/confirmation?code=111111&code=222222',
    )
  })

  it('ชั้นจองปฏิเสธ: คืนข้อความภาษาไทยให้แสดง inline โดยไม่ redirect', async () => {
    submitBookingSelectionMock.mockResolvedValue({
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

  it('trim ค่า roomId และส่งบล็อกว่างเมื่อไม่มี/ผิดรูปแบบ', async () => {
    await bookRoom(null, form({ ...VALID_FORM, roomId: '  room-s  ' }))

    expect(submitBookingSelectionMock).toHaveBeenCalledWith(
      { roomId: 'room-s', date: '2026-10-19', blocks: BLOCKS },
      'u1',
    )

    submitBookingSelectionMock.mockClear()
    await bookRoom(null, form({ roomId: 'room-s', date: '2026-10-19' }))
    expect(submitBookingSelectionMock).toHaveBeenCalledWith(
      { roomId: 'room-s', date: '2026-10-19', blocks: [] },
      'u1',
    )

    submitBookingSelectionMock.mockClear()
    await bookRoom(null, form({ roomId: 'room-s', date: '2026-10-19', blocks: '{ไม่ใช่ json' }))
    expect(submitBookingSelectionMock).toHaveBeenCalledWith(
      { roomId: 'room-s', date: '2026-10-19', blocks: [] },
      'u1',
    )
  })
})
