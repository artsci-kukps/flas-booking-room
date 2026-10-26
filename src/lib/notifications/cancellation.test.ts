import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { BookingCancellationEmailInput } from './email'

/**
 * เทสต์ตัวช่วยส่งอีเมลยกเลิกการจอง (ticket #21)
 * จำลอง query ของ drizzle (select ต่อ join หลายชั้นตามแบบฉบับของเทสต์เดิม)
 * และฉีดตัวส่งเพื่อไม่แตะ SMTP/ฐานข้อมูลจริง
 */

let detailRows: unknown[] = []
let selectError: Error | null = null

function chain(): Record<string, unknown> {
  const query: Record<string, unknown> = {}
  query.innerJoin = () => query
  query.where = () => query
  query.orderBy = () => query
  query.limit = () => (selectError ? Promise.reject(selectError) : Promise.resolve(detailRows))
  query.then = (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
    (selectError ? Promise.reject(selectError) : Promise.resolve(detailRows)).then(resolve, reject)
  return query
}

const { selectMock, fromMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  fromMock: vi.fn(),
}))

vi.mock('@/db', () => ({
  default: {
    select: (...args: unknown[]) => selectMock(...args),
  },
}))

fromMock.mockImplementation(() => chain())
selectMock.mockImplementation(() => ({ from: fromMock }))

import { sendBookingCancellationForReservation } from './cancellation'

const DETAILS = {
  bookingCode: '123456',
  roomName: 'S-101',
  bookingDate: '2026-10-19',
  startTime: new Date('2026-10-19T02:30:00Z'),
  endTime: new Date('2026-10-19T03:30:00Z'),
  toEmail: 'booker@ku.th',
}

beforeEach(() => {
  vi.clearAllMocks()
  detailRows = [DETAILS]
  selectError = null
  fromMock.mockClear()
  selectMock.mockImplementation(() => ({ from: fromMock }))
})

describe('sendBookingCancellationForReservation', () => {
  it('ดึงข้อมูลการจองแล้วส่งอีเมลยกเลิกพร้อมเหตุผล', async () => {
    const send = vi.fn<(input: BookingCancellationEmailInput) => Promise<void>>(async () => {})

    await sendBookingCancellationForReservation('res-1', 'ผู้ใช้โทรขอยกเลิก', { send })

    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0]).toEqual({
      toEmail: 'booker@ku.th',
      bookingCode: '123456',
      roomName: 'S-101',
      bookingDate: '2026-10-19',
      startTime: new Date('2026-10-19T02:30:00Z'),
      endTime: new Date('2026-10-19T03:30:00Z'),
      reason: 'ผู้ใช้โทรขอยกเลิก',
    })
  })

  it('ไม่มีเหตุผล (ผู้ใช้ยกเลิกเอง) → ส่ง reason เป็น null', async () => {
    const send = vi.fn<(input: BookingCancellationEmailInput) => Promise<void>>(async () => {})

    await sendBookingCancellationForReservation('res-1', null, { send })

    expect(send.mock.calls[0][0]).toMatchObject({ reason: null })
  })

  it('หาไม่พบการจอง → ไม่ส่งอีเมล', async () => {
    detailRows = []
    const send = vi.fn<(input: BookingCancellationEmailInput) => Promise<void>>(async () => {})

    await sendBookingCancellationForReservation('res-missing', null, { send })

    expect(send).not.toHaveBeenCalled()
  })

  it('ไม่มีอีเมลผู้จอง → ไม่ส่งอีเมล (ไม่โยน error)', async () => {
    detailRows = [{ ...DETAILS, toEmail: null }]
    const send = vi.fn<(input: BookingCancellationEmailInput) => Promise<void>>(async () => {})

    await sendBookingCancellationForReservation('res-1', null, { send })

    expect(send).not.toHaveBeenCalled()
  })

  it('ส่งไม่สำเร็จ → ไม่โยนออก (การยกเลิกต้องไม่ล้มเหลวเพราะอีเมล)', async () => {
    const send = vi.fn<(input: BookingCancellationEmailInput) => Promise<void>>(async () => {
      throw new Error('smtp down')
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      sendBookingCancellationForReservation('res-1', null, { send }),
    ).resolves.toBeUndefined()
    expect(errorSpy).toHaveBeenCalled()

    errorSpy.mockRestore()
  })

  it('อ่านข้อมูลการจองไม่สำเร็จ → ไม่โยนออก (best-effort)', async () => {
    selectError = new Error('db down')
    const send = vi.fn<(input: BookingCancellationEmailInput) => Promise<void>>(async () => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      sendBookingCancellationForReservation('res-1', null, { send }),
    ).resolves.toBeUndefined()
    expect(send).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalled()

    errorSpy.mockRestore()
  })
})
