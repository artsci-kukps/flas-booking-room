import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  holiday as holidayTable,
  reservation as reservationTable,
  roomBlock as roomBlockTable,
  rooms as roomsTable,
  servicePeriod as servicePeriodTable,
} from '@/db/schema'
import { makeHoliday, makeServicePeriod } from '@/lib/admin/test-fixtures'

import { createReservation, getBookingConfirmation, randomBookingCode } from './reservations'

/**
 * จำลอง query ของ drizzle แบบ "await ได้" ตามแบบฉบับของ day-availability.test.ts
 * ขยายด้วย insert().values().returning(), execute() และ transaction() สำหรับเส้นทางบันทึกการจอง
 */

/** ลำดับการทำงานที่บันทึกไว้ตรวจ (ล็อก → นับ → insert) */
let callLog: string[] = []

function chainQuery(rows: unknown[]) {
  const query = {
    orderBy: () => query,
    innerJoin: () => query,
    where: (arg: unknown) => {
      // เก็บ parameter ของ where clause ไว้ตรวจ (ความปลอดภัย: การค้นต้องจำกัดด้วย user id)
      collectSqlParams(arg, whereParams)
      return query
    },
    limit: () => Promise.resolve(rows),
    then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  }
  return query
}

/** ไล่ SQL object ของ drizzle แล้วเก็บค่า parameter (string เปล่า/Param) — StringChunk เป็นข้อความ SQL ไม่ใช่ค่า */
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

/** parameter ที่ส่งเข้า where clause ระหว่างเทสต์ (คนละตัวกับ rows ที่ query คืน) */
let whereParams: string[] = []

/** แถวที่ db.select().from(table) แต่ละตารางจะคืน */
const rowsByTable = new Map<unknown, unknown[]>()

function setTableRows(table: unknown, rows: unknown[]) {
  rowsByTable.set(table, rows)
}

/** ข้อผิดพลาดที่ insert จะ throw ทีละรายการ (แถวแรก = ครั้งแรกที่ insert) */
let insertErrors: unknown[] = []

/** ค่าที่ insert().values() ถูกเรียกครั้งละรายการ */
let insertedValues: unknown[] = []

function makeInsertMock() {
  return {
    values: (values: Record<string, unknown>) => {
      callLog.push('insert')
      insertedValues.push(values)

      return {
        returning: () => {
          const error = insertErrors.shift()
          if (error !== undefined) {
            return Promise.reject(error)
          }
          return Promise.resolve([{ bookingCode: values.bookingCode }])
        },
      }
    },
  }
}

const executeMock = vi.fn(async () => {
  callLog.push('lock')
  return []
})

const txSelectMock = vi.fn(() => ({
  from: (table: unknown) => {
    callLog.push('count')
    return chainQuery(rowsByTable.get(table) ?? [])
  },
}))

const txMock = {
  execute: executeMock,
  select: txSelectMock,
  insert: makeInsertMock,
}

const { selectMock, insertMock, transactionMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  insertMock: vi.fn(),
  transactionMock: vi.fn(),
}))

vi.mock('@/db', () => ({
  default: {
    select: (...args: unknown[]) => selectMock(...args),
    insert: (...args: unknown[]) => insertMock(...args),
    transaction: (...args: unknown[]) => transactionMock(...args),
  },
}))

const fromMock = vi.fn((table: unknown) => chainQuery(rowsByTable.get(table) ?? []))

beforeEach(() => {
  vi.clearAllMocks()
  callLog = []
  insertErrors = []
  insertedValues = []
  whereParams = []
  rowsByTable.clear()

  selectMock.mockReturnValue({ from: fromMock })
  insertMock.mockImplementation(() => makeInsertMock())
  transactionMock.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(txMock))

  // ค่าเริ่มต้น: วันทำการปกติ ไม่มีวันหยุด/บล็อก/การจอง และห้อง S CAPACITY ความจุ 4
  setTableRows(servicePeriodTable, [makeServicePeriod({ id: 'sp-1' })])
  setTableRows(holidayTable, [])
  setTableRows(roomsTable, [
    { roomId: 'room-s', roomName: 'S-101', maxCapacity: 4, bookingMode: 'CAPACITY', minDurationMinutes: 60 },
  ])
  setTableRows(roomBlockTable, [])
  setTableRows(reservationTable, [])
})

// วันทดสอบ: 2026-10-19 = จันตร์ — ช่องว่าง 08:30–09:30, 09:30–10:30, … (NORMAL 08:30–16:30)
const MONDAY = '2026-10-19'
const BEFORE_OPEN = new Date('2026-10-18T17:00:00Z') // 00:30 Bangkok — ก่อนเวลาเปิดของวัน
const REQUEST = { roomId: 'room-s', date: MONDAY, startTime: '09:30', endTime: '10:30' }

describe('createReservation', () => {
  it('ห้อง CAPACITY ที่ยังมีที่ว่าง: ล็อกต่อห้อง นับจำนวนที่ใช้ แล้ว insert PENDING พร้อมรหัส 6 หลัก', async () => {
    // มีผู้ใช้ครองช่วงซ้อนอยู่ 3 จาก 4 ที่นั่ง — ยังจองได้
    setTableRows(
      reservationTable,
      Array.from({ length: 3 }, (_, i) => ({ id: `r-${i}` })),
    )

    const result = await createReservation(REQUEST, 'u1', {
      now: BEFORE_OPEN,
      generateCode: () => '123456',
    })

    expect(result).toEqual({ ok: true, bookingCode: '123456' })
    // ลำดับ A.5: advisory lock ก่อนนับ แล้วจึง insert
    expect(callLog).toEqual(['lock', 'count', 'insert'])
    // lock ต่อห้องที่จองด้วย hashtextextended ของ room id (สูตร A.5)
    // queryChunks ของ drizzle: StringChunk = ข้อความ SQL, string ธรรมดา = ค่า parameter
    const lockCall = executeMock.mock.calls[0] as unknown as [{ queryChunks: unknown[] }]
    const lockChunks = lockCall[0].queryChunks
    const lockText = lockChunks
      .filter((chunk): chunk is { value: string[] } => typeof chunk !== 'string')
      .flatMap((chunk) => chunk.value)
      .join('')
    const lockParam = lockChunks.find((chunk) => typeof chunk === 'string')
    expect(lockText).toContain('pg_advisory_xact_lock(hashtextextended(')
    expect(lockParam).toBe('room-s')
    expect(insertedValues).toEqual([
      {
        userId: 'u1',
        roomId: 'room-s',
        bookingMode: 'CAPACITY',
        bookingDate: MONDAY,
        bookingCode: '123456',
        startTime: new Date('2026-10-19T02:30:00Z'), // 09:30 Bangkok
        endTime: new Date('2026-10-19T03:30:00Z'), // 10:30 Bangkok
        status: 'PENDING',
      },
    ])
  })

  it('วันที่รูปแบบไม่ถูกต้อง: ปฏิเสธโดยไม่ดึงข้อมูลใด ๆ จาก DB', async () => {
    const result = await createReservation(
      { ...REQUEST, date: '2026-02-30' },
      'u1',
      { now: BEFORE_OPEN },
    )

    expect(result).toEqual({ ok: false, message: 'วันที่เลือกไม่ถูกต้อง กรุณาเลือกวันที่ใหม่' })
    expect(fromMock).not.toHaveBeenCalled()
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('วันเสาร์–อาทิตย์: ปฏิเสธด้วยข้อความปิดทำการ ไม่มีการ insert', async () => {
    const result = await createReservation(
      { ...REQUEST, date: '2026-10-17' }, // เสาร์
      'u1',
      { now: BEFORE_OPEN },
    )

    expect(result).toEqual({
      ok: false,
      message: 'วันเสาร์–อาทิตย์ปิดทำการ ไม่สามารถจองได้',
    })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('วันหยุดนักขัตฤกษ์: ปฏิเสธพร้อมชื่อวันหยุดในข้อความ', async () => {
    setTableRows(holidayTable, [makeHoliday({ id: 'h-1', holidayDate: MONDAY, name: 'วันปิยมหาราช' })])

    const result = await createReservation(REQUEST, 'u1', { now: BEFORE_OPEN })

    expect(result).toEqual({
      ok: false,
      message: 'เป็นวันหยุด วันปิยมหาราช ระบบปิดทำการ ไม่สามารถจองได้',
    })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('ไม่มีช่วงเวลาให้บริการที่มีผลในวันนั้น: ปฏิเสธด้วยข้อความยังไม่มีเวลาให้บริการ', async () => {
    setTableRows(servicePeriodTable, [
      makeServicePeriod({ id: 'sp-1', effectiveFrom: '2027-01-01', effectiveTo: '2027-01-31' }),
    ])

    const result = await createReservation(REQUEST, 'u1', { now: BEFORE_OPEN })

    expect(result).toEqual({
      ok: false,
      message: 'ยังไม่มีช่วงเวลาให้บริการสำหรับวันที่เลือก',
    })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('ช่วงเวลาที่เกินเวลาปิดของวัน (ไม่ตรงกับ slot ใด): ปฏิเสธด้วยข้อความอยู่นอกเวลาให้บริการ', async () => {
    // NORMAL 08:30–16:30 — 16:00–17:00 ทะลุเวลาปิด 16:30 จึงไม่มี slot นี้
    const result = await createReservation(
      { ...REQUEST, startTime: '16:00', endTime: '17:00' },
      'u1',
      { now: BEFORE_OPEN },
    )

    expect(result).toEqual({
      ok: false,
      message: 'ช่วงเวลาที่เลือกไม่อยู่ในเวลาให้บริการของวันนั้น กรุณาเลือกช่วงเวลาใหม่',
    })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('เวลาที่ไม่ตรงขอบเขต slot (พิมพ์เอง เช่น 09:00): ปฏิเสธเช่นเดียวกัน', async () => {
    const result = await createReservation(
      { ...REQUEST, startTime: '09:00', endTime: '10:00' },
      'u1',
      { now: BEFORE_OPEN },
    )

    expect(result).toMatchObject({
      ok: false,
      message: 'ช่วงเวลาที่เลือกไม่อยู่ในเวลาให้บริการของวันนั้น กรุณาเลือกช่วงเวลาใหม่',
    })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('ช่องเวลาที่เริ่มไปแล้ว: ปฏิเสธด้วยข้อความเวลาผ่านไปแล้ว', async () => {
    // 10:00 Bangkok ของวันจอง — ช่อง 09:30 เริ่มไปแล้ว
    const result = await createReservation(REQUEST, 'u1', {
      now: new Date('2026-10-19T03:00:00Z'),
    })

    expect(result).toEqual({
      ok: false,
      message: 'ช่วงเวลาที่เลือกเริ่มไปแล้ว กรุณาเลือกช่วงเวลาใหม่',
    })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('ไม่พบห้อง (ไม่มีจริง/ถูก soft delete ไปแล้ว): ปฏิเสธด้วยข้อความไม่พบห้อง', async () => {
    setTableRows(roomsTable, [])

    const result = await createReservation(REQUEST, 'u1', { now: BEFORE_OPEN })

    expect(result).toEqual({
      ok: false,
      message: 'ไม่พบห้องที่เลือก ห้องอาจถูกยกเลิกไปแล้ว กรุณารีเฟรชหน้าแล้วลองใหม่',
    })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('ครบระยะเวลาขั้นต่ำตามประเภทห้อง: ห้อง G (EXCLUSIVE, อย่างน้อย 120 นาที) ไม่ผ่านเมื่อเลือก 1 บล็อก', async () => {
    setTableRows(roomsTable, [
      { roomId: 'room-g', roomName: 'G-101', maxCapacity: null, bookingMode: 'EXCLUSIVE', minDurationMinutes: 120 },
    ])

    const result = await createReservation(
      { roomId: 'room-g', date: MONDAY, startTime: '09:30', endTime: '10:30' },
      'u1',
      { now: BEFORE_OPEN },
    )

    expect(result).toEqual({
      ok: false,
      message: 'ห้องนี้ต้องจองอย่างน้อย 120 นาที กรุณาเลือกช่วงเวลาต่อเนื่องให้ครบ',
    })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('ห้อง S (อย่างน้อย 60 นาที) ผ่านระยะเวลาขั้นต่ำเมื่อเลือกครบ 1 บล็อก', async () => {
    // ผลรวม: เส้นทาง insert ของห้อง CAPACITY ผ่าน ไม่ใช่ติดที่ min duration
    const result = await createReservation(REQUEST, 'u1', {
      now: BEFORE_OPEN,
      generateCode: () => '654321',
    })

    expect(result).toEqual({ ok: true, bookingCode: '654321' })
  })

  it('ทับ room_block ของห้องเดียวกัน: ปฏิเสธด้วยข้อความห้องถูกบล็อก ไม่มีการ insert', async () => {
    setTableRows(roomBlockTable, [
      { id: 'rb-1', startTime: new Date('2026-10-19T02:30:00Z'), endTime: new Date('2026-10-19T04:00:00Z') }, // 09:30–11:00
    ])

    const result = await createReservation(REQUEST, 'u1', { now: BEFORE_OPEN })

    expect(result).toEqual({
      ok: false,
      message: 'ห้องนี้ถูกบล็อกในช่วงเวลาที่เลือก กรุณาเลือกห้องหรือช่วงเวลาอื่น',
    })
    expect(insertMock).not.toHaveBeenCalled()
  })

  // หมายเหตุ: นิยามการซ้อนกันแบบ [) ของคอลัมน์ where (ชนกันตรงขอบไม่นับ)
  // ตรวจแล้วที่ computeRoomSlots ใน day-availability.test.ts — ที่นี่ mock คืนแถวตามที่ query จริงจะคืน

  // ---- concurrency: การแย่งกันจองที่ DB เป็นด่านสุดท้าย ----

  /** เลียนแบบ pg error ที่ Drizzle ห่อไว้ (DrizzleQueryError มี code/message ของ pg อยู่ที่ cause) */
  function wrappedPgError(code: string, pgMessage: string): Error {
    const cause = Object.assign(new Error(pgMessage), { code })
    return new Error('Failed query: INSERT INTO "reservation"\nparams: [...]', { cause })
  }

  const ROOM_EXCLUSIVE_VIOLATION =
    'conflicting key value violates exclusion constraint "reservation_room_exclusive", key'
  const USER_NO_OVERLAP_VIOLATION =
    'conflicting key value violates exclusion constraint "reservation_user_no_overlap", key'

  it('แย่งกันจองห้อง EXCLUSIVE: สอง insert พร้อมกัน → ตัวที่สองชน reservation_room_exclusive ได้ข้อความไทย', async () => {
    setTableRows(roomsTable, [
      { roomId: 'room-g', roomName: 'G-101', maxCapacity: null, bookingMode: 'EXCLUSIVE', minDurationMinutes: 120 },
    ])
    setTableRows(reservationTable, []) // G ต้องใช้ 2 บล็อก — ยังไม่ถึง min duration
    insertErrors = [wrappedPgError('23P01', ROOM_EXCLUSIVE_VIOLATION)]

    const result = await createReservation(
      { roomId: 'room-g', date: MONDAY, startTime: '09:30', endTime: '11:30' },
      'u1',
      { now: BEFORE_OPEN, generateCode: () => '111111' },
    )

    expect(result).toEqual({
      ok: false,
      message: 'ช่วงเวลานี้มีผู้ใช้จองห้องนี้แล้ว กรุณาเลือกช่วงเวลาอื่น',
    })
    // ห้อง EXCLUSIVE ไม่ล็อก/ไม่นับเอง — ปล่อยให้ exclusion constraint กัน แล้วแปลงข้อความ
    expect(executeMock).not.toHaveBeenCalled()
    expect(callLog).toEqual(['insert'])
  })

  it('ผู้ใช้คนเดียวห้ามจองทับการจองของตัวเอง: ชน reservation_user_no_overlap ได้ข้อความไทย (ผ่าน transaction ของห้อง CAPACITY)', async () => {
    insertErrors = [wrappedPgError('23P01', USER_NO_OVERLAP_VIOLATION)]

    const result = await createReservation(REQUEST, 'u1', {
      now: BEFORE_OPEN,
      generateCode: () => '111111',
    })

    expect(result).toEqual({
      ok: false,
      message: 'คุณมีการจองอื่นที่ทับซ้อนกับช่วงเวลานี้อยู่แล้ว กรุณาเลือกช่วงเวลาอื่น',
    })
    expect(transactionMock).toHaveBeenCalledTimes(1)
  })

  it('แย่งกันจองห้อง CAPACITY จนเต็ม: ล็อกแล้วนับได้เท่ากับ max_capacity → ปฏิเสธโดยไม่ insert', async () => {
    setTableRows(
      reservationTable,
      Array.from({ length: 4 }, (_, i) => ({ id: `r-${i}` })), // เท่ากับความจุ 4 — เต็มพอดี
    )

    const result = await createReservation(REQUEST, 'u1', {
      now: BEFORE_OPEN,
      generateCode: () => '111111',
    })

    expect(result).toEqual({
      ok: false,
      message: 'ห้องเต็มความจุในช่วงเวลานี้แล้ว กรุณาเลือกช่วงเวลาอื่น',
    })
    // นับหลังล็อกเท่านั้น และไม่มี insert หลังรู้ว่าเต็ม
    expect(callLog).toEqual(['lock', 'count'])
    expect(insertedValues).toHaveLength(0)
  })

  it('รหัสซ้ำกับการจองวันเดียวกัน (unique 23505): สุ่มใหม่แล้ว insert ซ้ำจนสำเร็จ', async () => {
    insertErrors = [wrappedPgError('23505', 'duplicate key value violates unique constraint "reservation_code_per_day"')]
    const codes = ['111111', '222222']
    const generateCode = () => codes.shift()!

    const result = await createReservation(REQUEST, 'u1', {
      now: BEFORE_OPEN,
      generateCode,
    })

    expect(result).toEqual({ ok: true, bookingCode: '222222' })
    // สองความพยายาม — ความพยายามที่สองใช้รหัสใหม่ (แถวแรกไม่ถูกบันทึกเพราะ rollback)
    expect(insertedValues.map((values) => (values as { bookingCode: string }).bookingCode)).toEqual([
      '111111',
      '222222',
    ])
    expect(transactionMock).toHaveBeenCalledTimes(2)
  })

  it('สุ่มรหัสซ้ำไม่สำเร็จตลอดความพยายาม: คืนข้อความลองใหม่ ไม่ throw ทิ้ง', async () => {
    insertErrors = Array.from({ length: 5 }, () =>
      wrappedPgError('23505', 'duplicate key value violates unique constraint "reservation_code_per_day"'),
    )

    const result = await createReservation(REQUEST, 'u1', {
      now: BEFORE_OPEN,
      generateCode: () => '111111',
    })

    expect(result).toEqual({
      ok: false,
      message: 'ไม่สามารถสร้างรหัสการจองได้ กรุณาลองใหม่อีกครั้ง',
    })
    expect(insertedValues).toHaveLength(5)
  })

  it('ข้อผิดพลาดที่ไม่รู้จักถูกโยนทิ้งต่อ (ไม่ถูกกลบเป็นข้อความจองล้มเหลว)', async () => {
    insertErrors = [wrappedPgError('XX000', 'unexpected database error')]

    await expect(
      createReservation(REQUEST, 'u1', { now: BEFORE_OPEN, generateCode: () => '111111' }),
    ).rejects.toThrow('Failed query')
  })
})

describe('randomBookingCode', () => {
  it('คืนตัวเลข 6 หลักเสมอ (รวม leading zero) ภายในช่วง 000000–999999', () => {
    for (let i = 0; i < 200; i++) {
      const code = randomBookingCode()

      expect(code).toMatch(/^\d{6}$/)
      expect(Number(code)).toBeGreaterThanOrEqual(0)
      expect(Number(code)).toBeLessThan(1_000_000)
    }
  })
})

describe('getBookingConfirmation', () => {
  const BOOKING_ROW = {
    bookingCode: '123456',
    status: 'PENDING',
    roomName: 'S-101',
    roomTypeCode: 'S',
    bookingDate: '2026-10-19',
    startTime: new Date('2026-10-19T02:30:00Z'),
    endTime: new Date('2026-10-19T03:30:00Z'),
  }

  it('คืนข้อมูลหน้ายืนยันตามรหัส และจำกัดด้วย user id ของผู้เรียก (ไม่เห็นรหัสของคนอื่น)', async () => {
    setTableRows(reservationTable, [BOOKING_ROW])

    const result = await getBookingConfirmation('123456', 'u1')

    expect(result).toEqual(BOOKING_ROW)
    // where clause ต้องมีทั้งรหัสและ user id — ตรวจจาก parameter ที่ส่งเข้า query
    expect(whereParams).toContain('123456')
    expect(whereParams).toContain('u1')
  })

  it('คืน null เมื่อไม่พบรหัส (หรือรหัสไม่ใช่ของผู้ใช้คนนี้)', async () => {
    setTableRows(reservationTable, [])

    expect(await getBookingConfirmation('999999', 'u1')).toBeNull()
  })
})
