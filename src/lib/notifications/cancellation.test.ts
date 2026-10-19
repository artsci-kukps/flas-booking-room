import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EnqueueBookingCancellationEmail } from './outbox'

/**
 * เทสต์ตัวช่วยเข้าคิวอีเมลยกเลิกการจอง (ticket #21)
 * จำลอง query ของ drizzle (select ต่อ join หลายชั้นตามแบบฉบับของเทสต์เดิม)
 * และฉีดตัว enqueue เพื่อไม่แตะ Resend/ฐานข้อมูลจริง
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

import { enqueueBookingCancellationForReservation } from './cancellation'

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

describe('enqueueBookingCancellationForReservation', () => {
  it('ดึงข้อมูลการจองแล้วเข้าคิวอีเมลยกเลิกพร้อมเหตุผล', async () => {
    const enqueue = vi.fn<(input: EnqueueBookingCancellationEmail) => Promise<void>>(async () => {})

    await enqueueBookingCancellationForReservation('res-1', 'ผู้ใช้โทรขอยกเลิก', { enqueue })

    expect(enqueue).toHaveBeenCalledTimes(1)
    expect(enqueue.mock.calls[0][0]).toEqual({
      reservationId: 'res-1',
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
    const enqueue = vi.fn<(input: EnqueueBookingCancellationEmail) => Promise<void>>(async () => {})

    await enqueueBookingCancellationForReservation('res-1', null, { enqueue })

    expect(enqueue.mock.calls[0][0]).toMatchObject({ reason: null })
  })

  it('หาไม่พบการจอง → ไม่เข้าคิว', async () => {
    detailRows = []
    const enqueue = vi.fn<(input: EnqueueBookingCancellationEmail) => Promise<void>>(async () => {})

    await enqueueBookingCancellationForReservation('res-missing', null, { enqueue })

    expect(enqueue).not.toHaveBeenCalled()
  })

  it('ไม่มีอีเมลผู้จอง → ไม่เข้าคิว (ไม่โยน error)', async () => {
    detailRows = [{ ...DETAILS, toEmail: null }]
    const enqueue = vi.fn<(input: EnqueueBookingCancellationEmail) => Promise<void>>(async () => {})

    await enqueueBookingCancellationForReservation('res-1', null, { enqueue })

    expect(enqueue).not.toHaveBeenCalled()
  })

  it('เข้าคิวไม่สำเร็จ → ไม่โยนออก (การยกเลิกต้องไม่ล้มเหลวเพราะอีเมล)', async () => {
    const enqueue = vi.fn<(input: EnqueueBookingCancellationEmail) => Promise<void>>(async () => {
      throw new Error('queue down')
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      enqueueBookingCancellationForReservation('res-1', null, { enqueue }),
    ).resolves.toBeUndefined()
    expect(errorSpy).toHaveBeenCalled()

    errorSpy.mockRestore()
  })

  it('อ่านข้อมูลการจองไม่สำเร็จ → ไม่โยนออก (best-effort)', async () => {
    selectError = new Error('db down')
    const enqueue = vi.fn<(input: EnqueueBookingCancellationEmail) => Promise<void>>(async () => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      enqueueBookingCancellationForReservation('res-1', null, { enqueue }),
    ).resolves.toBeUndefined()
    expect(enqueue).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalled()

    errorSpy.mockRestore()
  })
})
