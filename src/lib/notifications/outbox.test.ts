import { beforeEach, describe, expect, it, vi } from 'vitest'

import { notificationOutbox } from '@/db/schema'

import {
  BOOKING_CODE_EMAIL_TYPE,
  MAX_OUTBOX_ATTEMPTS,
  enqueueBookingCodeEmail,
  nextRetryAt,
  processOutboxBatch,
} from './outbox'

/** จำลอง query ของ drizzle แบบ await ได้ + เก็บ parameter ของ where / ค่าที่ set ไว้ตรวจ */

let whereParams: string[] = []

function collectSqlParams(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    out.push(value)
    return
  }

  if (!value || typeof value !== 'object') {
    return
  }

  if ('queryChunks' in value) {
    for (const chunk of (value as { queryChunks: unknown[] }).queryChunks) {
      collectSqlParams(chunk, out)
    }
    return
  }

  if (value.constructor?.name === 'Param') {
    const param = (value as { value?: unknown }).value
    if (typeof param === 'string') out.push(param)
  }
}

const {
  selectMock,
  selectWhereMock,
  selectOrderByMock,
  selectLimitMock,
  insertMock,
  insertValuesMock,
  updateMock,
  updateSetMock,
  updateWhereMock,
} = vi.hoisted(() => {
  const selectLimitMock = vi.fn(async () => [] as unknown[])
  const selectOrderByMock = vi.fn(() => ({ limit: selectLimitMock }))
  const selectWhereMock = vi.fn((arg: unknown) => {
    collectSqlParams(arg, whereParams)
    return { orderBy: selectOrderByMock }
  })
  const selectFromMock = vi.fn(() => ({ where: selectWhereMock }))
  const selectMock = vi.fn(() => ({ from: selectFromMock }))

  const insertValuesMock = vi.fn<(values: Record<string, unknown>) => Promise<undefined>>(
    async () => undefined,
  )
  const insertMock = vi.fn(() => ({ values: insertValuesMock }))

  const updateWhereMock = vi.fn(async () => undefined)
  const updateSetMock = vi.fn(() => ({ where: updateWhereMock }))
  const updateMock = vi.fn(() => ({ set: updateSetMock }))

  return {
    selectMock,
    selectWhereMock,
    selectOrderByMock,
    selectLimitMock,
    insertMock,
    insertValuesMock,
    updateMock,
    updateSetMock,
    updateWhereMock,
  }
})

vi.mock('@/db', () => ({
  default: { select: selectMock, insert: insertMock, update: updateMock },
}))

const NOW = new Date('2026-10-18T00:05:00Z')

type SenderMessage = { to: string; subject: string; html: string; text: string }

/** แถวคิวตัวอย่าง (payload ถูกต้อง) */
function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'o1',
    reservationId: 'res-1',
    type: BOOKING_CODE_EMAIL_TYPE,
    toEmail: 'booker@ku.th',
    subject: 'รหัสการจอง Creative Space: 123456',
    payload: {
      bookingCode: '123456',
      roomName: 'S-101',
      bookingDate: '2026-10-19',
      startTime: '2026-10-19T02:30:00.000Z',
      endTime: '2026-10-19T03:30:00.000Z',
    },
    status: 'PENDING',
    attempts: 0,
    lastError: null,
    nextAttemptAt: new Date('2026-10-18T00:00:00Z'),
    sentAt: null,
    createdAt: new Date('2026-10-18T00:00:00Z'),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  whereParams = []
  selectLimitMock.mockResolvedValue([])
  insertValuesMock.mockResolvedValue(undefined)
  updateWhereMock.mockResolvedValue(undefined)
})

describe('nextRetryAt', () => {
  it('นโยบาย retry: 1, 5, 15, 60 นาที แล้วเลิกที่ความพยายามครั้งที่ 5', () => {
    expect(MAX_OUTBOX_ATTEMPTS).toBe(5)
    expect(nextRetryAt(1, NOW)).toEqual(new Date('2026-10-18T00:06:00Z'))
    expect(nextRetryAt(2, NOW)).toEqual(new Date('2026-10-18T00:10:00Z'))
    expect(nextRetryAt(3, NOW)).toEqual(new Date('2026-10-18T00:20:00Z'))
    expect(nextRetryAt(4, NOW)).toEqual(new Date('2026-10-18T01:05:00Z'))
    expect(nextRetryAt(5, NOW)).toBeNull()
  })
})

describe('enqueueBookingCodeEmail', () => {
  it('สร้างรายการคิว BOOKING_CODE พร้อม payload รหัส/ห้อง/ช่วงเวลา และ to_email ของผู้จอง', async () => {
    await enqueueBookingCodeEmail({
      reservationId: 'res-1',
      toEmail: 'booker@ku.th',
      bookingCode: '123456',
      roomName: 'S-101',
      bookingDate: '2026-10-19',
      startTime: new Date('2026-10-19T02:30:00Z'),
      endTime: new Date('2026-10-19T03:30:00Z'),
    })

    expect(insertMock).toHaveBeenCalledWith(notificationOutbox)
    expect(insertValuesMock).toHaveBeenCalledTimes(1)
    expect(insertValuesMock.mock.calls[0][0]).toEqual({
      reservationId: 'res-1',
      type: BOOKING_CODE_EMAIL_TYPE,
      toEmail: 'booker@ku.th',
      subject: 'รหัสการจอง Creative Space: 123456',
      payload: {
        bookingCode: '123456',
        roomName: 'S-101',
        bookingDate: '2026-10-19',
        startTime: '2026-10-19T02:30:00.000Z',
        endTime: '2026-10-19T03:30:00.000Z',
      },
    })
  })

  it('เรียกซ้ำต่อหนึ่งการจอง → หนึ่งรายการคิวต่อการจองหนึ่งระเบียน', async () => {
    const base = {
      toEmail: 'booker@ku.th',
      roomName: 'S-101',
      bookingDate: '2026-10-19',
      startTime: new Date('2026-10-19T02:30:00Z'),
      endTime: new Date('2026-10-19T03:30:00Z'),
    }

    await enqueueBookingCodeEmail({ ...base, reservationId: 'res-1', bookingCode: '111111' })
    await enqueueBookingCodeEmail({ ...base, reservationId: 'res-2', bookingCode: '222222' })

    expect(insertValuesMock).toHaveBeenCalledTimes(2)
    expect(
      insertValuesMock.mock.calls.map((call) => (call[0] as { reservationId: string }).reservationId),
    ).toEqual(['res-1', 'res-2'])
  })
})

describe('processOutboxBatch', () => {
  it('หยิบเฉพาะ PENDING ที่ถึงเวลา เรียงตาม next_attempt_at และจำกัด batch', async () => {
    await processOutboxBatch({ now: NOW, sender: vi.fn<(message: SenderMessage) => Promise<void>>(async () => {}), batchSize: 7 })

    expect(selectWhereMock).toHaveBeenCalledTimes(1)
    expect(whereParams).toContain('PENDING')
    expect(selectOrderByMock).toHaveBeenCalledTimes(1)
    expect(selectLimitMock).toHaveBeenCalledWith(7)
  })

  it('ส่งสำเร็จ → SENT + sent_at และไม่เพิ่ม attempts', async () => {
    selectLimitMock.mockResolvedValue([makeRow()])
    const sender = vi.fn<(message: SenderMessage) => Promise<void>>(async () => {})

    const result = await processOutboxBatch({ now: NOW, sender })

    expect(result).toEqual({ sent: 1, retried: 0, failed: 0 })
    expect(sender).toHaveBeenCalledTimes(1)
    const message = sender.mock.calls[0][0] as { to: string; subject: string; html: string }
    expect(message.to).toBe('booker@ku.th')
    expect(message.subject).toContain('123456')
    expect(message.html).toContain('123456')
    expect(updateSetMock).toHaveBeenCalledWith({ status: 'SENT', sentAt: NOW, lastError: null })
  })

  it('ส่งไม่สำเร็จครั้งแรก → attempts = 1 และตั้ง retry อีก 1 นาที (ยัง PENDING)', async () => {
    selectLimitMock.mockResolvedValue([makeRow({ attempts: 0 })])
    const sender = vi.fn<(message: SenderMessage) => Promise<void>>(async () => {
      throw new Error('resend ล่ม')
    })

    const result = await processOutboxBatch({ now: NOW, sender })

    expect(result).toEqual({ sent: 0, retried: 1, failed: 0 })
    expect(updateSetMock).toHaveBeenCalledWith({
      attempts: 1,
      lastError: 'resend ล่ม',
      nextAttemptAt: new Date('2026-10-18T00:06:00Z'),
    })
  })

  it('ล้มเหลวถึงขีดจำกัด (ครั้งที่ 5) → FAILED + last_error โดยไม่ตั้ง retry อีก', async () => {
    selectLimitMock.mockResolvedValue([makeRow({ attempts: 4 })])
    const sender = vi.fn<(message: SenderMessage) => Promise<void>>(async () => {
      throw new Error('ยังล่มอยู่')
    })

    const result = await processOutboxBatch({ now: NOW, sender })

    expect(result).toEqual({ sent: 0, retried: 0, failed: 1 })
    expect(updateSetMock).toHaveBeenCalledWith({
      attempts: 5,
      lastError: 'ยังล่มอยู่',
      status: 'FAILED',
    })
  })

  it('payload ผิดรูปแบบ → FAILED ทันทีโดยไม่เรียกตัวส่ง (retry ไปก็ไม่สำเร็จ)', async () => {
    selectLimitMock.mockResolvedValue([makeRow({ payload: { bookingCode: '123456' } })])
    const sender = vi.fn<(message: SenderMessage) => Promise<void>>(async () => {})

    const result = await processOutboxBatch({ now: NOW, sender })

    expect(sender).not.toHaveBeenCalled()
    expect(result).toEqual({ sent: 0, retried: 0, failed: 1 })
    expect(updateSetMock).toHaveBeenCalledWith({
      attempts: 1,
      lastError: expect.stringContaining('payload'),
      status: 'FAILED',
    })
  })

  it('ประมวลผลแต่ละรายการแยกกัน — สำเร็จและล้มเหลวปนกันได้ในรอบเดียว', async () => {
    selectLimitMock.mockResolvedValue([
      makeRow({ id: 'o1' }),
      makeRow({ id: 'o2', attempts: 2 }),
    ])
    const sender = vi
      .fn<(message: SenderMessage) => Promise<void>>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('boom'))

    const result = await processOutboxBatch({ now: NOW, sender })

    expect(result).toEqual({ sent: 1, retried: 1, failed: 0 })
    expect(sender).toHaveBeenCalledTimes(2)
    expect(updateSetMock).toHaveBeenNthCalledWith(1, {
      status: 'SENT',
      sentAt: NOW,
      lastError: null,
    })
    expect(updateSetMock).toHaveBeenNthCalledWith(2, {
      attempts: 3,
      lastError: 'boom',
      nextAttemptAt: new Date('2026-10-18T00:20:00Z'),
    })
  })
})
