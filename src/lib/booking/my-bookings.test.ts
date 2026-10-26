import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  holiday as holidayTable,
  reservation as reservationTable,
  roomBlock as roomBlockTable,
  rooms as roomsTable,
  servicePeriod as servicePeriodTable,
} from '@/db/schema'
import { makeRoom, makeServicePeriod } from '@/lib/admin/test-fixtures'
import type { BookingCancellationEmailInput } from '@/lib/notifications/email'

import { getDayAvailability, OCCUPYING_STATUSES } from './day-availability'
import { CANCEL_ACTIVE_MESSAGE, cancelMyReservation, cancelability, listMyBookings } from './my-bookings'

// ไม่ยิง SMTP จริงจากเทสต์ (ผู้ยกเลิกบางเคสไม่ได้ฉีด sender)
vi.mock('@/services/email.service', () => ({
  sendEmail: vi.fn(async () => {}),
}))

/**
 * เทสต์ของการจองของฉันและการยกเลิกโดยผู้ใช้ (TOR ข้อ 6.4)
 * สถานะที่ยกเลิกได้: PENDING เท่านั้น และต้องก่อน start_time
 *
 * จำลอง query ของ drizzle ให้ "await ได้" และต่อ .where()/.orderBy()/.innerJoin() ได้
 * (แบบเดียวกับ reservations.test.ts) พร้อมเก็บ parameter ของ where ไว้ตรวจ
 */

function chainQuery(rows: unknown[], filterByStatus = false) {
  const params: string[] = []
  const resolve = () => {
    if (!filterByStatus) return rows
    // จำลอง WHERE status IN (...) ของ listOccupyingReservations: เก็บเฉพาะแถวสถานะที่ query ขอ
    const allowed = params.filter((param) => STATUS_VALUES.has(param))
    if (allowed.length === 0) return rows
    return rows.filter((row) =>
      allowed.includes((row as { status?: string }).status ?? ''),
    )
  }
  const query = {
    orderBy: () => query,
    innerJoin: () => query,
    where: (arg: unknown) => {
      collectSqlParams(arg, params)
      collectSqlParams(arg, whereParams)
      return query
    },
    limit: () => Promise.resolve(resolve()),
    then: (onFulfilled: (value: unknown[]) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(resolve()).then(onFulfilled, onRejected),
  }
  return query
}

const STATUS_VALUES = new Set([
  'PENDING',
  'ACTIVE',
  'COMPLETED',
  'LATE_RETURN',
  'CANCELLED',
  'NO_SHOW',
])

/** ไล่ SQL object ของ drizzle แล้วเก็บค่า parameter (string) — StringChunk เป็นข้อความ SQL */
function collectSqlParams(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    out.push(value)
    return
  }

  // inArray สร้าง chunk เป็น array ของ Param — ต้องไล่ลงไป
  if (Array.isArray(value)) {
    for (const item of value) {
      collectSqlParams(item, out)
    }
    return
  }

  if (!value || typeof value !== 'object') {
    return
  }

  if (value.constructor?.name === 'Param') {
    const param = (value as { value?: unknown }).value
    if (typeof param === 'string') out.push(param)
    return
  }

  if ('queryChunks' in value) {
    for (const chunk of (value as { queryChunks: unknown[] }).queryChunks) {
      collectSqlParams(chunk, out)
    }
  }
}

/** parameter ที่ส่งเข้า where clause ระหว่างเทสต์ */
let whereParams: string[] = []

/** แถวที่ db.select().from(table) แต่ละตารางจะคืน */
const rowsByTable = new Map<unknown, unknown[]>()

function setTableRows(table: unknown, rows: unknown[]) {
  rowsByTable.set(table, rows)
}

/** ผลลัพธ์ของ db.update().set().where().returning() และค่าที่ถูกเซ็ต */
let updateRows: unknown[] = []
let updatedValues: unknown[] = []
let updateWhereParams: string[] = []

const { selectMock, updateMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  updateMock: vi.fn(),
}))

vi.mock('@/db', () => ({
  default: {
    select: (...args: unknown[]) => selectMock(...args),
    update: (...args: unknown[]) => updateMock(...args),
  },
}))

const fromMock = vi.fn((table: unknown) =>
  chainQuery(rowsByTable.get(table) ?? [], table === reservationTable),
)

beforeEach(() => {
  vi.clearAllMocks()
  whereParams = []
  updateRows = []
  updatedValues = []
  updateWhereParams = []
  rowsByTable.clear()
  selectMock.mockReturnValue({ from: fromMock })
  updateMock.mockImplementation(() => ({
    set: (values: Record<string, unknown>) => {
      updatedValues.push(values)
      return {
        where: (arg: unknown) => {
          collectSqlParams(arg, updateWhereParams)
          return { returning: () => Promise.resolve(updateRows) }
        },
      }
    },
  }))
})

// 2026-10-19 = จันทร์, 09:30 Bangkok = 02:30Z
const START = new Date('2026-10-19T02:30:00Z')
const BEFORE_START = new Date('2026-10-19T02:00:00Z')
const AFTER_START = new Date('2026-10-19T03:00:00Z')

describe('cancelability', () => {
  it('PENDING ที่ยังไม่ถึงเวลาเริ่ม: ยกเลิกได้', () => {
    expect(cancelability('PENDING', START, BEFORE_START)).toEqual({ ok: true })
  })

  it('ACTIVE: ยกเลิกไม่ได้ แจ้งว่าต้องคืนกุญแจก่อน', () => {
    expect(cancelability('ACTIVE', START, BEFORE_START)).toEqual({
      ok: false,
      message: CANCEL_ACTIVE_MESSAGE,
    })
    expect(CANCEL_ACTIVE_MESSAGE).toContain('คืนกุญแจ')
  })

  it('PENDING ที่เลยเวลาเริ่มแล้ว: ยกเลิกไม่ได้', () => {
    const result = cancelability('PENDING', START, AFTER_START)

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.message).toContain('เวลาเริ่ม')
  })

  it('เริ่มพอดีเวลา start_time: นับว่าเลยเวลาแล้ว (ต้องก่อนเวลาเริ่มเท่านั้น)', () => {
    expect(cancelability('PENDING', START, START).ok).toBe(false)
  })

  it('สถานะอื่นที่ไม่ใช่ PENDING (COMPLETED/CANCELLED/NO_SHOW): ยกเลิกไม่ได้', () => {
    for (const status of ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'LATE_RETURN'] as const) {
      expect(cancelability(status, START, BEFORE_START)).toMatchObject({ ok: false })
    }
  })
})

describe('listMyBookings', () => {
  const ROW = {
    id: 'res-1',
    bookingCode: '123456',
    status: 'PENDING' as const,
    roomName: 'S-101',
    roomTypeCode: 'S',
    bookingDate: '2026-10-19',
    startTime: START,
    endTime: new Date('2026-10-19T03:30:00Z'),
    canceledAt: null,
  }

  it('ดึงเฉพาะการจองของผู้ใช้คนนี้ (visibility rule)', async () => {
    setTableRows(reservationTable, [ROW])

    await listMyBookings('u1', BEFORE_START)

    expect(whereParams).toContain('u1')
  })

  it('PENDING ก่อนเวลาเริ่ม: canCancel = true และไม่มีข้อความปิดกั้น', async () => {
    setTableRows(reservationTable, [ROW])

    const [booking] = await listMyBookings('u1', BEFORE_START)

    expect(booking).toMatchObject({ bookingCode: '123456', canCancel: true, cancelBlockedMessage: null })
  })

  it('ACTIVE: canCancel = false พร้อมข้อความต้องคืนกุญแจก่อน', async () => {
    setTableRows(reservationTable, [{ ...ROW, status: 'ACTIVE' }])

    const [booking] = await listMyBookings('u1', BEFORE_START)

    expect(booking).toMatchObject({ canCancel: false, cancelBlockedMessage: CANCEL_ACTIVE_MESSAGE })
  })

  it('PENDING ที่เลยเวลาเริ่ม: canCancel = false พร้อมข้อความเวลาเริ่ม', async () => {
    setTableRows(reservationTable, [ROW])

    const [booking] = await listMyBookings('u1', AFTER_START)

    expect(booking?.canCancel).toBe(false)
    expect(booking?.cancelBlockedMessage).toContain('เวลาเริ่ม')
  })
})

describe('cancelMyReservation', () => {
  it('PENDING ก่อนเวลาเริ่ม: อัปเดตเป็น CANCELLED พร้อม canceled_at/canceled_by', async () => {
    updateRows = [{ id: 'res-1' }]

    const result = await cancelMyReservation('res-1', 'u1', { now: BEFORE_START })

    expect(result).toEqual({ ok: true })
    expect(updatedValues).toEqual([
      { status: 'CANCELLED', canceledAt: BEFORE_START, canceledBy: 'u1', canceledReason: null },
    ])
    // เงื่อนไขต้องล็อก id + เจ้าของ + สถานะ PENDING (กันยกเลิกการจองของคนอื่น/ที่เปลี่ยนสถานะแล้ว)
    expect(updateWhereParams).toEqual(expect.arrayContaining(['res-1', 'u1', 'PENDING']))
  })

  it('ยกเลิกสำเร็จ → ส่งอีเมลแจ้งเตือนการยกเลิกทันที (reason = null)', async () => {
    updateRows = [{ id: 'res-1' }]
    setTableRows(reservationTable, [
      {
        bookingCode: '123456',
        roomName: 'S-101',
        bookingDate: '2026-10-19',
        startTime: START,
        endTime: new Date('2026-10-19T03:30:00Z'),
        toEmail: 'booker@ku.th',
      },
    ])
    const send = vi.fn<(input: BookingCancellationEmailInput) => Promise<void>>(async () => {})

    const result = await cancelMyReservation('res-1', 'u1', { now: BEFORE_START, send })

    expect(result).toEqual({ ok: true })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0]).toEqual({
      toEmail: 'booker@ku.th',
      bookingCode: '123456',
      roomName: 'S-101',
      bookingDate: '2026-10-19',
      startTime: START,
      endTime: new Date('2026-10-19T03:30:00Z'),
      reason: null,
    })
  })

  it('ยกเลิกไม่สำเร็จ (ACTIVE) → ไม่ส่งอีเมล', async () => {
    updateRows = []
    setTableRows(reservationTable, [{ status: 'ACTIVE', startTime: START }])
    const send = vi.fn<(input: BookingCancellationEmailInput) => Promise<void>>(async () => {})

    const result = await cancelMyReservation('res-1', 'u1', { now: BEFORE_START, send })

    expect(result).toEqual({ ok: false, message: CANCEL_ACTIVE_MESSAGE })
    expect(send).not.toHaveBeenCalled()
  })

  it('ส่งอีเมลล้มเหลว → การยกเลิกยังสำเร็จ (non-blocking)', async () => {
    updateRows = [{ id: 'res-1' }]
    setTableRows(reservationTable, [
      {
        bookingCode: '123456',
        roomName: 'S-101',
        bookingDate: '2026-10-19',
        startTime: START,
        endTime: new Date('2026-10-19T03:30:00Z'),
        toEmail: 'booker@ku.th',
      },
    ])
    const send = vi.fn<(input: BookingCancellationEmailInput) => Promise<void>>(async () => {
      throw new Error('queue down')
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await cancelMyReservation('res-1', 'u1', { now: BEFORE_START, send })

    expect(result).toEqual({ ok: true })
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('ไม่พบรายการ หรือไม่ใช่การจองของผู้ใช้คนนี้: ไม่แตะข้อมูล และแจ้งไม่พบ', async () => {
    updateRows = []
    setTableRows(reservationTable, [])

    const result = await cancelMyReservation('res-9', 'u1', { now: BEFORE_START })

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.message).toContain('ไม่พบ')
    expect(updatedValues).toHaveLength(1) // พยายามอัปเดต แต่ where ไม่โดน (DB เป็นผู้ตัดสิน)
  })

  it('ACTIVE: ยกเลิกไม่ได้ แจ้งว่าต้องคืนกุญแจก่อน', async () => {
    updateRows = []
    setTableRows(reservationTable, [{ status: 'ACTIVE', startTime: START }])

    const result = await cancelMyReservation('res-1', 'u1', { now: BEFORE_START })

    expect(result).toEqual({ ok: false, message: CANCEL_ACTIVE_MESSAGE })
  })

  it('PENDING แต่เลยเวลาเริ่มแล้ว: ยกเลิกไม่ได้', async () => {
    updateRows = []
    setTableRows(reservationTable, [{ status: 'PENDING', startTime: START }])

    const result = await cancelMyReservation('res-1', 'u1', { now: AFTER_START })

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.message).toContain('เวลาเริ่ม')
  })

  it('ยกเลิกไปแล้ว (CANCELLED): ยกเลิกซ้ำไม่ได้', async () => {
    updateRows = []
    setTableRows(reservationTable, [{ status: 'CANCELLED', startTime: START }])

    const result = await cancelMyReservation('res-1', 'u1', { now: BEFORE_START })

    expect(result).toMatchObject({ ok: false })
  })

  it('สถานะเปลี่ยนระหว่างทาง (update ไม่โดน แต่ยัง PENDING ก่อนเริ่ม): แจ้งให้รีเฟรช', async () => {
    updateRows = []
    setTableRows(reservationTable, [{ status: 'PENDING', startTime: START }])

    const result = await cancelMyReservation('res-1', 'u1', { now: BEFORE_START })

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.message).toContain('รีเฟรช')
  })
})

/**
 * AC: "ยกเลิกแล้วช่องว่างว่างทันที ผู้ใช้คนอื่น/ตัวเองจองทับได้"
 * กลไกคือสถานะ CANCELLED ไม่อยู่ใน OCCUPYING_STATUSES และ exclusion constraint
 * ของ DB ครอบเฉพาะ PENDING/ACTIVE — ความพร้อมของวันจึงมองข้ามรายการที่ยกเลิก
 */
describe('ช่องที่ยกเลิกแล้วว่างทันที', () => {
  const MONDAY = '2026-10-19'
  const NOW_0800 = new Date('2026-10-19T01:00:00Z') // 08:00 Bangkok
  const RANGE = {
    roomId: 'room-g',
    startTime: new Date('2026-10-19T01:30:00Z'), // 08:30
    endTime: new Date('2026-10-19T03:30:00Z'), // 10:30
  }

  beforeEach(() => {
    setTableRows(servicePeriodTable, [makeServicePeriod({ id: 'sp-1' })])
    setTableRows(holidayTable, [])
    setTableRows(roomsTable, [
      makeRoom({
        id: 'room-g',
        name: 'G-101',
        roomTypeCode: 'G',
        roomTypeName: 'ห้องประชุมใหญ่',
        bookingMode: 'EXCLUSIVE',
        maxCapacity: null,
      }),
    ])
    setTableRows(roomBlockTable, [])
  })

  it('CANCELLED ไม่ใช่สถานะครองช่วงเวลา (ปล่อยห้องทันที)', () => {
    expect(OCCUPYING_STATUSES).toEqual(['PENDING', 'ACTIVE'])
    expect(OCCUPYING_STATUSES).not.toContain('CANCELLED')
  })

  it('การจองที่ยกเลิกแล้วไม่ถูกนับเป็นผู้ใช้ห้อง — ช่องกลับมา free/selectable', async () => {
    setTableRows(reservationTable, [{ ...RANGE, status: 'CANCELLED' }])

    const result = await getDayAvailability(MONDAY, NOW_0800)

    expect(result.open).toBe(true)
    if (!result.open) return

    const roomG = result.rooms[0]!
    expect(roomG.slots[0]).toMatchObject({ start: '08:30', status: 'free', selectable: true })
    expect(roomG.slots[1]).toMatchObject({ start: '09:30', status: 'free', selectable: true })
  })

  it('การจอง ACTIVE ยังครองช่วงเวลาเดิม (กลุ่มควบคุม) — ช่องเลือกไม่ได้', async () => {
    setTableRows(reservationTable, [{ ...RANGE, status: 'ACTIVE' }])

    const result = await getDayAvailability(MONDAY, NOW_0800)

    expect(result.open).toBe(true)
    if (!result.open) return

    const roomG = result.rooms[0]!
    expect(roomG.slots[0]).toMatchObject({ start: '08:30', status: 'occupied', selectable: false })
    expect(roomG.slots[1]).toMatchObject({ start: '09:30', status: 'occupied', selectable: false })
  })
})
