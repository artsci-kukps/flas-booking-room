import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * เทสต์ชั้นข้อมูลของตารางจองฝั่งแอดมิน (ticket #11)
 * ใช้วิธีเดียวกับ holidays.test.ts / reservations.test.ts:
 *   จำลอง query ของ drizzle แล้วตรวจ "ค่า parameter" ที่ถูกผูกเข้า where/set
 * เพราะสิ่งที่ต้องพิสูจน์คือกติกาความปลอดภัยและกติกาสถานะ ไม่ใช่รูป SQL
 */

let selectResults: unknown[][] = []
// แถวผลลัพธ์ของ update — ถ้าเป็น Error จะ reject (จำลอง pg error ที่ Drizzle ห่อไว้)
let updateResults: (unknown[] | Error)[] = []
let whereParams: string[] = []
let updateWhereParams: string[] = []
let setCalls: Record<string, unknown>[] = []
// ค่าที่สั่ง set ไว้ล่าสุด — จะถูกบันทึกใน setCalls เฉพาะเมื่อมีแถวที่ตรงเงื่อนไข where จริง
let pendingSet: Record<string, unknown> | null = null

/** ไล่ SQL object ของ drizzle แล้วเก็บค่า parameter ที่เป็น string (Param) */
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
    if (param instanceof Date) out.push(param.toISOString())
  }
}

function chainQuery(rows: unknown[]) {
  const query = {
    innerJoin: () => query,
    where: (arg: unknown) => {
      collectSqlParams(arg, whereParams)
      return query
    },
    orderBy: () => Promise.resolve(rows),
    limit: () => Promise.resolve(rows),
    then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  }
  return query
}

const { selectMock, fromMock, updateMock, setMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  fromMock: vi.fn(),
  updateMock: vi.fn(),
  setMock: vi.fn(),
}))

const { sendCancellationMock } = vi.hoisted(() => ({
  sendCancellationMock: vi.fn<(reservationId: string, reason: string | null) => Promise<void>>(
    async () => {},
  ),
}))

vi.mock('@/lib/notifications/cancellation', () => ({
  sendBookingCancellationForReservation: (...args: [string, string | null]) =>
    sendCancellationMock(...args),
}))

vi.mock('@/db', () => ({
  default: {
    select: (...args: unknown[]) => selectMock(...args),
    update: (...args: unknown[]) => updateMock(...args),
  },
}))

import {
  cancelReservation,
  confirmKeyPickup,
  confirmKeyReturn,
  findBookingByCodeOnDay,
  isBookingCode,
  listBookingsForDay,
  overrideReservationStatus,
  returnedStatus,
  validateStatusReason,
  type AdminBookingRow,
} from './booking-admin'

import { isReservationStatus, RESERVATION_STATUSES } from '@/lib/booking/reservation-status'
import { OCCUPYING_STATUSES } from '@/lib/booking/day-availability'

const MONDAY = '2026-10-19'
const END_TIME = new Date('2026-10-19T03:30:00Z') // 10:30 Bangkok

function bookingRow(overrides: Partial<AdminBookingRow> = {}): AdminBookingRow {
  return {
    id: 'r-1',
    bookingCode: '123456',
    bookerName: 'สมชาย ใจดี',
    bookerEmail: 'somchai@ku.th',
    roomName: 'S-101',
    roomTypeCode: 'S',
    startTime: new Date('2026-10-19T02:30:00Z'),
    endTime: END_TIME,
    status: 'PENDING',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  selectResults = []
  updateResults = []
  whereParams = []
  updateWhereParams = []
  setCalls = []
  pendingSet = null

  fromMock.mockImplementation(() => chainQuery(selectResults.shift() ?? []))
  selectMock.mockImplementation(() => ({ from: fromMock }))

  const updateQuery = {
    set: (values: Record<string, unknown>) => {
      pendingSet = values
      return {
        where: (arg: unknown) => {
          collectSqlParams(arg, updateWhereParams)
          return {
            returning: () => {
              const result = updateResults.shift() ?? []
              if (result instanceof Error) {
                pendingSet = null
                return Promise.reject(result)
              }
              // ค่าที่ set ถูกเขียนจริงเฉพาะแถวที่ตรงกับ where (เหมือน DB จริง)
              // ถ้าไม่มีแถวตรงเงื่อนไข → ไม่มีอะไรถูกเขียนลงฐานข้อมูล
              if (result.length > 0 && pendingSet) {
                setCalls.push(pendingSet)
              }
              pendingSet = null
              return Promise.resolve(result)
            },
          }
        },
      }
    },
  }
  updateMock.mockImplementation(() => updateQuery)
  setMock.mockClear()
})

describe('returnedStatus (ขอบเขต late return)', () => {
  it('คืนครบก่อนเวลาสิ้นสุด → COMPLETED', () => {
    expect(returnedStatus(END_TIME, new Date('2026-10-19T03:00:00Z'))).toBe('COMPLETED')
  })

  it('คืนพอดีเวลาสิ้นสุด (ไม่เกิน) → COMPLETED', () => {
    expect(returnedStatus(END_TIME, END_TIME)).toBe('COMPLETED')
  })

  it('คืนเกินเวลาสิ้นสุดแม้ 1 มิลลิวินาที → LATE_RETURN', () => {
    expect(returnedStatus(END_TIME, new Date(END_TIME.getTime() + 1))).toBe('LATE_RETURN')
  })
})

describe('isBookingCode', () => {
  it('รับรหัสตัวเลข 6 หลัก', () => {
    expect(isBookingCode('012345')).toBe(true)
  })

  it('ปฏิเสธรหัสที่ไม่ใช่ 6 หลัก หรือมีอักขระอื่น', () => {
    expect(isBookingCode('12345')).toBe(false)
    expect(isBookingCode('1234567')).toBe(false)
    expect(isBookingCode('12a456')).toBe(false)
  })
})

describe('listBookingsForDay', () => {
  it('คืนรายการของวันนั้น', async () => {
    const rows = [bookingRow()]
    selectResults = [rows]

    await expect(listBookingsForDay(MONDAY)).resolves.toEqual(rows)
  })

  it('จำกัดขอบเขตการค้นด้วยวันที่ของวันนั้น', async () => {
    selectResults = [[]]

    await listBookingsForDay(MONDAY)

    expect(whereParams).toContain(MONDAY)
  })
})

describe('findBookingByCodeOnDay', () => {
  it('ค้นด้วยรหัสและจำกัดที่วันนั้น — เห็นเฉพาะรหัสของวันเดียวกัน', async () => {
    selectResults = [[bookingRow()]]

    const result = await findBookingByCodeOnDay('123456', MONDAY)

    expect(result?.bookingCode).toBe('123456')
    expect(whereParams).toContain('123456')
    expect(whereParams).toContain(MONDAY)
  })

  it('คืน null เมื่อไม่พบรหัสในวันนั้น (รหัสของวันอื่นมองไม่เห็น)', async () => {
    selectResults = [[]]

    expect(await findBookingByCodeOnDay('999999', MONDAY)).toBeNull()
  })
})

describe('confirmKeyPickup', () => {
  const NOW = new Date('2026-10-19T02:45:00Z')

  it('PENDING → ACTIVE พร้อมบันทึกผู้ยืนยันและเวลา และกันซ้ำด้วยเงื่อนไขสถานะ', async () => {
    updateResults = [[{ id: 'r-1' }]]

    const result = await confirmKeyPickup('r-1', 'a1', NOW)

    expect(result).toEqual({ ok: true, status: 'ACTIVE' })
    expect(setCalls).toEqual([
      { status: 'ACTIVE', keyEnteredAt: NOW, keyEnteredBy: 'a1' },
    ])
    // เงื่อนไขต้องผูกทั้ง id และสถานะ PENDING — กันกดรับซ้ำ/รับจากสถานะอื่น
    expect(updateWhereParams).toContain('r-1')
    expect(updateWhereParams).toContain('PENDING')
  })

  it('รับซ้ำ/ไม่ใช่ PENDING → ปฏิเสธ ไม่แก้ข้อมูล', async () => {
    updateResults = [[]]
    selectResults = [[{ id: 'r-1' }]]

    const result = await confirmKeyPickup('r-1', 'a1', NOW)

    expect(result.ok).toBe(false)
  })

  it('ไม่พบรายการ → ข้อความไม่พบ', async () => {
    updateResults = [[]]
    selectResults = [[]]

    const result = await confirmKeyPickup('r-missing', 'a1', NOW)

    expect(result).toEqual({
      ok: false,
      message: 'ไม่พบรายการจองนี้ กรุณารีเฟรชหน้าแล้วลองใหม่',
    })
  })
})

describe('confirmKeyReturn', () => {
  it('คืนตรงเวลา → COMPLETED พร้อมผู้ยืนยันและเวลา', async () => {
    selectResults = [[{ id: 'r-1', endTime: END_TIME }]]
    updateResults = [[{ id: 'r-1' }]]
    const now = new Date('2026-10-19T03:00:00Z')

    const result = await confirmKeyReturn('r-1', 'a1', now)

    expect(result).toEqual({ ok: true, status: 'COMPLETED' })
    expect(setCalls).toEqual([
      { status: 'COMPLETED', keyReturnedAt: now, keyReturnedBy: 'a1' },
    ])
    // คืนได้เฉพาะ ACTIVE
    expect(updateWhereParams).toContain('r-1')
    expect(updateWhereParams).toContain('ACTIVE')
  })

  it('คืนช้ากว่า end_time → LATE_RETURN', async () => {
    selectResults = [[{ id: 'r-1', endTime: END_TIME }]]
    updateResults = [[{ id: 'r-1' }]]
    const now = new Date('2026-10-19T04:00:00Z')

    const result = await confirmKeyReturn('r-1', 'a1', now)

    expect(result).toEqual({ ok: true, status: 'LATE_RETURN' })
    expect(setCalls[0]).toMatchObject({ status: 'LATE_RETURN' })
  })

  it('คืนซ้ำ (ไม่ใช่ ACTIVE) → ปฏิเสธ ไม่แก้ข้อมูล', async () => {
    selectResults = [[{ id: 'r-1', endTime: END_TIME }]]
    updateResults = [[]]

    const result = await confirmKeyReturn('r-1', 'a1', new Date('2026-10-19T03:10:00Z'))

    expect(result.ok).toBe(false)
  })

  it('ไม่พบรายการ → ข้อความไม่พบ', async () => {
    selectResults = [[]]

    const result = await confirmKeyReturn('r-missing', 'a1', new Date())

    expect(result).toEqual({
      ok: false,
      message: 'ไม่พบรายการจองนี้ กรุณารีเฟรชหน้าแล้วลองใหม่',
    })
  })
})

// ============================================
// การยกเลิก/แก้ไขสถานะโดยแอดมิน (ticket #12)
// ============================================

const NOW = new Date('2026-10-19T02:45:00Z')

/** เลียนแบบ pg error ที่ Drizzle ห่อไว้ (code อยู่ที่ cause) */
function wrappedPgError(code: string, pgMessage: string): Error {
  const cause = Object.assign(new Error(pgMessage), { code })
  return new Error('Failed query: UPDATE "reservation"\nparams: [...]', { cause })
}

describe('validateStatusReason', () => {
  it('ปฏิเสธเหตุผลว่างหรือมีแต่ช่องว่าง', () => {
    expect(validateStatusReason('')).toBeTypeOf('string')
    expect(validateStatusReason('   ')).toBeTypeOf('string')
  })

  it('ยอมรับเหตุผลที่มีข้อความ', () => {
    expect(validateStatusReason('ผู้ใช้โทรขอยกเลิก')).toBeNull()
  })
})

describe('isReservationStatus', () => {
  it('รู้จักสถานะทั้ง 6', () => {
    for (const status of RESERVATION_STATUSES) {
      expect(isReservationStatus(status)).toBe(true)
    }
  })

  it('ปฏิเสธค่าที่ไม่ใช่สถานะ', () => {
    expect(isReservationStatus('BOGUS')).toBe(false)
    expect(isReservationStatus('cancelled')).toBe(false)
  })
})

describe('cancelReservation', () => {
  it('ยกเลิกได้ทุกสถานะ: ตั้ง CANCELLED พร้อม canceled_at/by/reason', async () => {
    updateResults = [[{ id: 'r-1' }]]

    const result = await cancelReservation('r-1', 'ผู้ใช้โทรขอยกเลิก', 'a1', NOW)

    expect(result).toEqual({ ok: true, status: 'CANCELLED' })
    expect(setCalls).toEqual([
      {
        status: 'CANCELLED',
        canceledAt: NOW,
        canceledBy: 'a1',
        canceledReason: 'ผู้ใช้โทรขอยกเลิก',
      },
    ])
    expect(updateWhereParams).toContain('r-1')
  })

  it('บังคับเหตุผล: ปฏิเสธเมื่อไม่ระบุเหตุผล โดยไม่แก้ข้อมูล', async () => {
    const result = await cancelReservation('r-1', '   ', 'a1', NOW)

    expect(result.ok).toBe(false)
    expect(setCalls).toHaveLength(0)
  })

  it('ปลดล็อกช่องว่างทันที: สถานะ CANCELLED ไม่ครองช่วงเวลา', async () => {
    updateResults = [[{ id: 'r-1' }]]

    await cancelReservation('r-1', 'เหตุผล', 'a1', NOW)

    // TOR ข้อ 6.2: มีเพียง PENDING/ACTIVE ที่ครองช่วงเวลา — CANCELLED จึงปล่อยห้อง
    expect(setCalls[0]).toMatchObject({ status: 'CANCELLED' })
    expect(OCCUPYING_STATUSES).toContain('ACTIVE')
    expect(OCCUPYING_STATUSES).not.toContain('CANCELLED')
  })

  it('ไม่พบรายการ → ข้อความไม่พบ', async () => {
    updateResults = [[]]

    const result = await cancelReservation('r-missing', 'เหตุผล', 'a1', NOW)

    expect(result).toEqual({
      ok: false,
      message: 'ไม่พบรายการจองนี้ กรุณารีเฟรชหน้าแล้วลองใหม่',
    })
  })

  it('เงื่อนไข UPDATE ผูกสถานะเดิมไว้ด้วย → กันยกเลิกซ้ำแบบ atomic', async () => {
    updateResults = [[{ id: 'r-1' }]]

    await cancelReservation('r-1', 'เหตุผล', 'a1', NOW)

    expect(updateWhereParams).toContain('r-1')
    expect(updateWhereParams).toContain('CANCELLED')
  })

  it('ยกเลิกแถวที่ยกเลิกไปแล้ว → ไม่เขียนทับร่องรอยเดิม และไม่ส่งอีเมลซ้ำ', async () => {
    updateResults = [[]]
    selectResults = [[{ id: 'r-1', status: 'CANCELLED' }]]

    const result = await cancelReservation('r-1', 'เหตุผลที่ยกเลิกซ้ำ', 'a1', NOW)

    expect(result).toEqual({ ok: true, status: 'CANCELLED' })
    // ไม่เขียนทับ canceled_at/by/reason เดิมของแถวที่ยกเลิกไปแล้ว
    expect(setCalls).toHaveLength(0)
    expect(sendCancellationMock).not.toHaveBeenCalled()
  })

  it('สถานะเปลี่ยนไปแล้วระหว่างที่กด (แข่งกับผู้ดำเนินการอื่น) → ข้อความให้รีเฟรชหน้า', async () => {
    updateResults = [[]]
    selectResults = [[{ id: 'r-1', status: 'ACTIVE' }]]

    const result = await cancelReservation('r-1', 'เหตุผล', 'a1', NOW)

    expect(result).toEqual({
      ok: false,
      message: 'สถานะของรายการจองเปลี่ยนไปแล้ว กรุณารีเฟรชหน้าแล้วลองใหม่',
    })
    expect(sendCancellationMock).not.toHaveBeenCalled()
  })

  it('ยกเลิกสำเร็จ → เข้าคิวอีเมลแจ้งเตือนการยกเลิกพร้อมเหตุผล (ตัดช่องว่างหัวท้าย)', async () => {
    updateResults = [[{ id: 'r-1' }]]

    const result = await cancelReservation('r-1', '  ผู้ใช้โทรขอยกเลิก  ', 'a1', NOW)

    expect(result).toEqual({ ok: true, status: 'CANCELLED' })
    expect(sendCancellationMock).toHaveBeenCalledTimes(1)
    expect(sendCancellationMock).toHaveBeenCalledWith('r-1', 'ผู้ใช้โทรขอยกเลิก')
  })

  it('ยกเลิกไม่สำเร็จ (ไม่พบรายการ) → ไม่เข้าคิวอีเมล', async () => {
    updateResults = [[]]

    await cancelReservation('r-missing', 'เหตุผล', 'a1', NOW)

    expect(sendCancellationMock).not.toHaveBeenCalled()
  })

  it('บังคับเหตุผลไม่ผ่าน → ไม่เข้าคิวอีเมล', async () => {
    const result = await cancelReservation('r-1', '   ', 'a1', NOW)

    expect(result.ok).toBe(false)
    expect(sendCancellationMock).not.toHaveBeenCalled()
  })
})

describe('overrideReservationStatus', () => {
  it('override NO_SHOW → ACTIVE ได้ทันที พร้อมบันทึกผู้ดำเนินการและเหตุผล', async () => {
    updateResults = [[{ id: 'r-1' }]]

    const result = await overrideReservationStatus(
      'r-1',
      'ACTIVE',
      'ระบบตั้ง NO_SHOW ผิด ผู้ใช้มารับกุญแจแล้ว',
      'a1',
      NOW,
    )

    expect(result).toEqual({ ok: true, status: 'ACTIVE' })
    expect(setCalls).toEqual([
      {
        status: 'ACTIVE',
        canceledAt: NOW,
        canceledBy: 'a1',
        canceledReason: 'ระบบตั้ง NO_SHOW ผิด ผู้ใช้มารับกุญแจแล้ว',
      },
    ])
    // ไม่ใช่การยกเลิก → ไม่มีอีเมลยกเลิก
    expect(sendCancellationMock).not.toHaveBeenCalled()
  })

  it('override ไปสถานะอื่นได้เสมอ (เช่น COMPLETED)', async () => {
    updateResults = [[{ id: 'r-1' }]]

    const result = await overrideReservationStatus('r-1', 'COMPLETED', 'เหตุผล', 'a1', NOW)

    expect(result).toEqual({ ok: true, status: 'COMPLETED' })
    expect(setCalls[0]).toMatchObject({ status: 'COMPLETED' })
  })

  it('ปฏิเสธสถานะที่ไม่รู้จัก โดยไม่แก้ข้อมูล', async () => {
    const result = await overrideReservationStatus('r-1', 'BOGUS', 'เหตุผล', 'a1', NOW)

    expect(result.ok).toBe(false)
    expect(setCalls).toHaveLength(0)
  })

  it('บังคับเหตุผล: ปฏิเสธเมื่อไม่ระบุเหตุผล', async () => {
    const result = await overrideReservationStatus('r-1', 'ACTIVE', '  ', 'a1', NOW)

    expect(result.ok).toBe(false)
    expect(setCalls).toHaveLength(0)
  })

  it('ไม่พบรายการ → ข้อความไม่พบ', async () => {
    updateResults = [[]]

    const result = await overrideReservationStatus('r-missing', 'ACTIVE', 'เหตุผล', 'a1', NOW)

    expect(result).toEqual({
      ok: false,
      message: 'ไม่พบรายการจองนี้ กรุณารีเฟรชหน้าแล้วลองใหม่',
    })
  })

  it('override ไป CANCELLED สำเร็จ → เข้าคิวอีเมลแจ้งเตือนการยกเลิก (ตัดช่องว่างหัว-ท้าย เหตุผล)', async () => {
    updateResults = [[{ id: 'r-1' }]]

    const result = await overrideReservationStatus('r-1', 'CANCELLED', '  เหตุผล  ', 'a1', NOW)

    expect(result).toEqual({ ok: true, status: 'CANCELLED' })
    expect(sendCancellationMock).toHaveBeenCalledWith('r-1', 'เหตุผล')
  })

  it('override ไม่พบรายการ → ไม่เข้าคิวอีเมล', async () => {
    updateResults = [[]]

    await overrideReservationStatus('r-missing', 'CANCELLED', 'เหตุผล', 'a1', NOW)

    expect(sendCancellationMock).not.toHaveBeenCalled()
  })

  it('override จาก CANCELLED ไปสถานะอื่นได้ (แก้สถานะที่ระบบตั้งผิด) — ไม่ถูกเงื่อนไขกันซ้ำบล็อก', async () => {
    updateResults = [[{ id: 'r-1' }]]

    const result = await overrideReservationStatus(
      'r-1',
      'ACTIVE',
      'ระบบตั้งผิด ผู้ใช้มาใช้งานจริง',
      'a1',
      NOW,
    )

    expect(result).toEqual({ ok: true, status: 'ACTIVE' })
    expect(setCalls[0]).toMatchObject({ status: 'ACTIVE' })
    expect(sendCancellationMock).not.toHaveBeenCalled()
  })

  it('override ไป CANCELLED บนแถวที่ยกเลิกไปแล้ว → ไม่เขียนทับร่องรอยเดิม ไม่ส่งอีเมลซ้ำ', async () => {
    updateResults = [[]]
    selectResults = [[{ id: 'r-1', status: 'CANCELLED' }]]

    const result = await overrideReservationStatus('r-1', 'CANCELLED', 'เหตุผลที่ยกเลิกซ้ำ', 'a1', NOW)

    expect(result).toEqual({ ok: true, status: 'CANCELLED' })
    expect(setCalls).toHaveLength(0)
    expect(sendCancellationMock).not.toHaveBeenCalled()
  })

  it('override ไปสถานะที่แถวมีอยู่แล้ว → ไม่แก้ข้อมูลซ้ำ ไม่ส่งอีเมล', async () => {
    updateResults = [[]]
    selectResults = [[{ id: 'r-1', status: 'ACTIVE' }]]

    const result = await overrideReservationStatus('r-1', 'ACTIVE', 'เหตุผล', 'a1', NOW)

    expect(result).toEqual({ ok: true, status: 'ACTIVE' })
    expect(setCalls).toHaveLength(0)
    expect(sendCancellationMock).not.toHaveBeenCalled()
  })
})

describe('การจัดการข้อผิดพลาดจากการเขียนสถานะ', () => {
  it('override ไปครองช่วงแล้วชนห้อง EXCLUSIVE (23P01) → ข้อความไทย ไม่ throw', async () => {
    updateResults = [
      wrappedPgError(
        '23P01',
        'conflicting key value violates exclusion constraint "reservation_room_exclusive", key',
      ),
    ]

    const result = await overrideReservationStatus('r-1', 'ACTIVE', 'เหตุผล', 'a1', NOW)

    expect(result).toEqual({ ok: false, message: expect.any(String) })
  })

  it('override ชนการจองซ้อนของผู้ใช้เอง (23P01) → ข้อความไทย', async () => {
    updateResults = [
      wrappedPgError(
        '23P01',
        'conflicting key value violates exclusion constraint "reservation_user_no_overlap", key',
      ),
    ]

    const result = await overrideReservationStatus('r-1', 'ACTIVE', 'เหตุผล', 'a1', NOW)

    expect(result).toEqual({ ok: false, message: expect.any(String) })
  })

  it('id ที่ไม่ใช่ uuid (22P02) ถือว่าไม่พบรายการ ไม่ throw', async () => {
    updateResults = [wrappedPgError('22P02', 'invalid input syntax for type uuid: "abc"')]

    const result = await cancelReservation('abc', 'เหตุผล', 'a1', NOW)

    expect(result).toEqual({
      ok: false,
      message: 'ไม่พบรายการจองนี้ กรุณารีเฟรชหน้าแล้วลองใหม่',
    })
  })

  it('ข้อผิดพลาดที่ไม่รู้จักถูกโยนทิ้งต่อ (ไม่ถูกกลบ)', async () => {
    updateResults = [wrappedPgError('XX000', 'unexpected database error')]

    await expect(
      overrideReservationStatus('r-1', 'ACTIVE', 'เหตุผล', 'a1', NOW),
    ).rejects.toThrow('Failed query')
  })
})
