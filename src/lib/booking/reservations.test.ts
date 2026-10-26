import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  holiday as holidayTable,
  reservation as reservationTable,
  roomBlock as roomBlockTable,
  rooms as roomsTable,
  servicePeriod as servicePeriodTable,
  users as usersTable,
} from '@/db/schema'
import { makeHoliday, makeServicePeriod } from '@/lib/admin/test-fixtures'
import type { SendBookingCodeEmailFn } from '@/lib/notifications/email'

import {
  createReservation,
  createReservations,
  getBookingConfirmation,
  randomBookingCode,
  submitBookingSelection,
} from './reservations'

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
          return Promise.resolve([{ id: `res-${insertedValues.length}`, bookingCode: values.bookingCode }])
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

  it('วันพรุ่งนี้ (อยู่ในหน้าต่างจองได้): จองได้ตามปกติ', async () => {
    // today (BEFORE_OPEN) = 2026-10-19 → พรุ่งนี้ = อังคาร 2026-10-20
    const result = await createReservation(
      { ...REQUEST, date: '2026-10-20' },
      'u1',
      { now: BEFORE_OPEN, generateCode: () => '123456' },
    )

    expect(result).toEqual({ ok: true, bookingCode: '123456' })
  })

  it('วันมะรืน (เกินหน้าต่างจองได้): ปฏิเสธด้วยข้อความจองได้เฉพาะวันนี้/พรุ่งนี้ ไม่แตะ DB', async () => {
    const result = await createReservation(
      { ...REQUEST, date: '2026-10-21' }, // พุธ — เกินหน้าต่าง
      'u1',
      { now: BEFORE_OPEN },
    )

    expect(result).toEqual({
      ok: false,
      message: 'จองได้เฉพาะวันนี้หรือวันพรุ่งนี้เท่านั้น กรุณาเลือกวันที่ใหม่',
    })
    expect(fromMock).not.toHaveBeenCalled()
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('วันย้อนหลัง (เมื่อวาน): ปฏิเสธด้วยข้อความหน้าต่างจองได้เช่นกัน', async () => {
    const result = await createReservation(
      { ...REQUEST, date: '2026-10-18' }, // อยู่ก่อนวันนี้ (2026-10-19)
      'u1',
      { now: BEFORE_OPEN },
    )

    expect(result).toEqual({
      ok: false,
      message: 'จองได้เฉพาะวันนี้หรือวันพรุ่งนี้เท่านั้น กรุณาเลือกวันที่ใหม่',
    })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('วันเสาร์–อาทิตย์: ปฏิเสธด้วยข้อความปิดทำการ ไม่มีการ insert', async () => {
    const result = await createReservation(
      { ...REQUEST, date: '2026-10-17' }, // เสาร์ — อยู่ในหน้าต่างจองได้ (วันพรุ่งนี้ของ 2026-10-16)
      'u1',
      { now: new Date('2026-10-15T17:00:00Z') },
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

  it('ห้อง G: บล็อกละ 2 ชั่วโมง — ช่วง 1 ชั่วโมง (09:30–10:30) ไม่ตรงขอบบล็อก จึงถูกปฏิเสธ', async () => {
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
      message: 'ช่วงเวลาที่เลือกไม่อยู่ในเวลาให้บริการของวันนั้น กรุณาเลือกช่วงเวลาใหม่',
    })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('ห้อง G: เลือกครบหนึ่งบล็อก 2 ชั่วโมง (08:30–10:30) ผ่านการจอง', async () => {
    setTableRows(roomsTable, [
      { roomId: 'room-g', roomName: 'G-101', maxCapacity: null, bookingMode: 'EXCLUSIVE', minDurationMinutes: 120 },
    ])

    const result = await createReservation(
      { roomId: 'room-g', date: MONDAY, startTime: '08:30', endTime: '10:30' },
      'u1',
      { now: BEFORE_OPEN, generateCode: () => '777777' },
    )

    expect(result).toEqual({ ok: true, bookingCode: '777777' })
    expect(insertedValues[0]).toMatchObject({
      roomId: 'room-g',
      bookingMode: 'EXCLUSIVE',
      startTime: new Date('2026-10-19T01:30:00Z'), // 08:30 Bangkok
      endTime: new Date('2026-10-19T03:30:00Z'), // 10:30 Bangkok
    })
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
    setTableRows(reservationTable, []) // ห้องว่าง — การปฏิเสธมาจาก exclusion constraint ของ DB
    insertErrors = [wrappedPgError('23P01', ROOM_EXCLUSIVE_VIOLATION)]

    const result = await createReservation(
      { roomId: 'room-g', date: MONDAY, startTime: '08:30', endTime: '10:30' },
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

  // ---- ส่งอีเมลรหัสทางอีเมล (#14): หนึ่งฉบับต่อการจองหนึ่งระเบียน ----

  it('จองสำเร็จ → ส่งอีเมลรหัสหนึ่งฉบับ พร้อมอีเมลผู้จองและข้อมูลห้อง/ช่วงเวลา', async () => {
    setTableRows(usersTable, [{ email: 'booker@ku.th' }])
    const sendEmail = vi.fn<SendBookingCodeEmailFn>(async () => {})

    const result = await createReservation(REQUEST, 'u1', {
      now: BEFORE_OPEN,
      generateCode: () => '123456',
      sendEmail,
    })

    expect(result).toEqual({ ok: true, bookingCode: '123456' })
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail.mock.calls[0][0]).toEqual({
      toEmail: 'booker@ku.th',
      bookingCode: '123456',
      roomName: 'S-101',
      bookingDate: MONDAY,
      startTime: new Date('2026-10-19T02:30:00Z'),
      endTime: new Date('2026-10-19T03:30:00Z'),
    })
  })

  it('จองห้อง EXCLUSIVE สำเร็จ → ส่งอีเมลเช่นกัน (หนึ่งครั้งต่อระเบียน)', async () => {
    setTableRows(roomsTable, [
      { roomId: 'room-g', roomName: 'G-101', maxCapacity: null, bookingMode: 'EXCLUSIVE', minDurationMinutes: 120 },
    ])
    setTableRows(usersTable, [{ email: 'booker@ku.th' }])
    const sendEmail = vi.fn<SendBookingCodeEmailFn>(async () => {})

    const result = await createReservation(
      { roomId: 'room-g', date: MONDAY, startTime: '08:30', endTime: '10:30' },
      'u1',
      { now: BEFORE_OPEN, generateCode: () => '654321', sendEmail },
    )

    expect(result).toEqual({ ok: true, bookingCode: '654321' })
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ roomName: 'G-101', bookingCode: '654321' })
  })

  it('ไม่พบอีเมลผู้จอง → จองสำเร็จแต่ไม่ส่งอีเมล', async () => {
    setTableRows(usersTable, [])
    const sendEmail = vi.fn<SendBookingCodeEmailFn>(async () => {})

    const result = await createReservation(REQUEST, 'u1', {
      now: BEFORE_OPEN,
      generateCode: () => '123456',
      sendEmail,
    })

    expect(result).toEqual({ ok: true, bookingCode: '123456' })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('จองไม่สำเร็จ (ห้องเต็ม) → ไม่ส่งอีเมล', async () => {
    setTableRows(
      reservationTable,
      Array.from({ length: 4 }, (_, i) => ({ id: `r-${i}` })),
    )
    setTableRows(usersTable, [{ email: 'booker@ku.th' }])
    const sendEmail = vi.fn<SendBookingCodeEmailFn>(async () => {})

    const result = await createReservation(REQUEST, 'u1', { now: BEFORE_OPEN, sendEmail })

    expect(result).toMatchObject({ ok: false })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('ส่งอีเมลล้มเหลว → การจองยังสำเร็จ (หน้ายืนยันยังแสดงรหัสเสมอ)', async () => {
    setTableRows(usersTable, [{ email: 'booker@ku.th' }])
    const sendEmail = vi.fn<SendBookingCodeEmailFn>(async () => {
      throw new Error('smtp down')
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await createReservation(REQUEST, 'u1', {
      now: BEFORE_OPEN,
      generateCode: () => '123456',
      sendEmail,
    })

    expect(result).toEqual({ ok: true, bookingCode: '123456' })
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
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

const NO_BLOCK_MESSAGE = 'กรุณาเลือกช่วงเวลาที่จะจองอย่างน้อย 1 บล็อก'
const MIXED_ROOM_MESSAGE = 'จองได้ทีละห้องต่อหนึ่งครั้ง กรุณาเลือกช่วงเวลาในห้องเดียวกัน'
const ROOM_TAKEN_MESSAGE = 'ช่วงเวลานี้มีผู้ใช้จองห้องนี้แล้ว กรุณาเลือกช่วงเวลาอื่น'

/** เลียนแบบ pg error ที่ Drizzle ห่อไว้ (ใช้ซ้ำได้ทั้งไฟล์) */
function wrappedPgError(code: string, pgMessage: string): Error {
  const cause = Object.assign(new Error(pgMessage), { code })
  return new Error('Failed query: INSERT INTO "reservation"\nparams: [...]', { cause })
}

const G_EXCLUSIVE_VIOLATION =
  'conflicting key value violates exclusion constraint "reservation_room_exclusive", key'

/** ลำดับรหัสที่ตัวสร้างจะคืน — ใช้แทน randomBookingCode ในเทสต์ */
function codeSequence(values: string[]): () => string {
  let index = 0
  return () => values[index++] ?? '000000'
}

function setRoomG() {
  setTableRows(roomsTable, [
    { roomId: 'room-g', roomName: 'G-101', maxCapacity: null, bookingMode: 'EXCLUSIVE', minDurationMinutes: 120 },
  ])
}

describe('createReservations (จองหลาย record)', () => {
  it('สอง record ห้องเดียวกัน (มีช่องว่างคั่น): insert คนละแถว ได้รหัสคนละรหัส', async () => {
    const result = await createReservations(
      [
        { roomId: 'room-s', date: MONDAY, startTime: '08:30', endTime: '09:30' },
        { roomId: 'room-s', date: MONDAY, startTime: '10:30', endTime: '11:30' },
      ],
      'u1',
      { now: BEFORE_OPEN, generateCode: codeSequence(['111111', '222222']) },
    )

    expect(result).toEqual({ ok: true, bookingCodes: ['111111', '222222'] })
    expect(insertedValues).toHaveLength(2)
    expect(
      insertedValues.map((values) => (values as { bookingCode: string }).bookingCode),
    ).toEqual(['111111', '222222'])
    expect(insertedValues[0]).toMatchObject({
      roomId: 'room-s',
      startTime: new Date('2026-10-19T01:30:00Z'), // 08:30 Bangkok
      endTime: new Date('2026-10-19T02:30:00Z'), // 09:30 Bangkok
    })
    expect(insertedValues[1]).toMatchObject({
      startTime: new Date('2026-10-19T03:30:00Z'), // 10:30 Bangkok
      endTime: new Date('2026-10-19T04:30:00Z'), // 11:30 Bangkok
    })
    // ทั้งชุดอยู่ใน transaction เดียว (atomic)
    expect(transactionMock).toHaveBeenCalledTimes(1)
  })

  it('สอง record → ส่งรหัสหนึ่งฉบับต่อระเบียน หลัง transaction commit (#14)', async () => {
    setTableRows(usersTable, [{ email: 'booker@ku.th' }])
    let committed = false
    transactionMock.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const result = await fn(txMock)
      committed = true
      return result
    })
    const sendEmail = vi.fn<SendBookingCodeEmailFn>(async () => {
      // ต้องไม่ส่งอีเมลก่อน transaction commit
      expect(committed).toBe(true)
    })

    const result = await createReservations(
      [
        { roomId: 'room-s', date: MONDAY, startTime: '08:30', endTime: '09:30' },
        { roomId: 'room-s', date: MONDAY, startTime: '10:30', endTime: '11:30' },
      ],
      'u1',
      { now: BEFORE_OPEN, generateCode: codeSequence(['111111', '222222']), sendEmail },
    )

    expect(result).toEqual({ ok: true, bookingCodes: ['111111', '222222'] })
    // หนึ่งระเบียน = หนึ่งอีเมล (ไม่ใช่หนึ่งฉบับต่อการจองทั้งชุด)
    expect(sendEmail).toHaveBeenCalledTimes(2)
    expect(sendEmail.mock.calls.map((call) => call[0].bookingCode)).toEqual(['111111', '222222'])
  })

  it('record ใดล้มเหลวกลางทาง → ไม่ส่งอีเมลเลย (ส่งหลัง commit เท่านั้น)', async () => {
    setRoomG()
    setTableRows(usersTable, [{ email: 'booker@ku.th' }])
    insertErrors = [undefined, wrappedPgError('23P01', G_EXCLUSIVE_VIOLATION)]
    const sendEmail = vi.fn<SendBookingCodeEmailFn>(async () => {})

    const result = await createReservations(
      [
        { roomId: 'room-g', date: MONDAY, startTime: '08:30', endTime: '10:30' },
        { roomId: 'room-g', date: MONDAY, startTime: '12:30', endTime: '14:30' },
      ],
      'u1',
      { now: BEFORE_OPEN, generateCode: codeSequence(['111111', '222222']), sendEmail },
    )

    expect(result).toEqual({ ok: false, message: ROOM_TAKEN_MESSAGE })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('ไม่มี record เลย: ปฏิเสธก่อนแตะ DB', async () => {
    const result = await createReservations([], 'u1', { now: BEFORE_OPEN })

    expect(result).toEqual({ ok: false, message: NO_BLOCK_MESSAGE })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it('record เดียว: เดินเส้นทาง createReservation ของ #8 (รหัสเดียว ไม่ครอบ transaction) ', async () => {
    setRoomG()

    const result = await createReservations(
      [{ roomId: 'room-g', date: MONDAY, startTime: '08:30', endTime: '10:30' }],
      'u1',
      { now: BEFORE_OPEN, generateCode: codeSequence(['111111']) },
    )

    expect(result).toEqual({ ok: true, bookingCodes: ['111111'] })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it('record อยู่นอกหน้าต่างจองได้ (วันมะรืน): ทั้งชุดถูกปฏิเสธ ไม่มี insert', async () => {
    const result = await createReservations(
      [
        { roomId: 'room-s', date: '2026-10-21', startTime: '08:30', endTime: '09:30' },
        { roomId: 'room-s', date: '2026-10-21', startTime: '10:30', endTime: '11:30' },
      ],
      'u1',
      { now: BEFORE_OPEN, generateCode: codeSequence(['111111', '222222']) },
    )

    expect(result).toEqual({
      ok: false,
      message: 'จองได้เฉพาะวันนี้หรือวันพรุ่งนี้เท่านั้น กรุณาเลือกวันที่ใหม่',
    })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('ข้ามห้องในหนึ่งการจองไม่ได้: ปฏิเสธก่อนแตะ DB', async () => {
    const result = await createReservations(
      [
        { roomId: 'room-s', date: MONDAY, startTime: '08:30', endTime: '09:30' },
        { roomId: 'room-g', date: MONDAY, startTime: '10:30', endTime: '11:30' },
      ],
      'u1',
      { now: BEFORE_OPEN, generateCode: codeSequence(['111111', '222222']) },
    )

    expect(result).toEqual({ ok: false, message: MIXED_ROOM_MESSAGE })
    expect(insertMock).not.toHaveBeenCalled()
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it('รหัสซ้ำกับการจองวันเดียวกันใน DB: ข้ามรหัสที่ใช้แล้วไปหารหัสใหม่', async () => {
    setRoomG()
    // มีการจองวันเดียวกันใช้รหัส 111111 อยู่แล้ว
    setTableRows(reservationTable, [{ bookingCode: '111111' }])

    const result = await createReservations(
      [
        { roomId: 'room-g', date: MONDAY, startTime: '08:30', endTime: '10:30' },
        { roomId: 'room-g', date: MONDAY, startTime: '12:30', endTime: '14:30' },
      ],
      'u1',
      { now: BEFORE_OPEN, generateCode: codeSequence(['111111', '222222', '333333']) },
    )

    expect(result).toEqual({ ok: true, bookingCodes: ['222222', '333333'] })
  })

  it('record ใดล้มเหลวกลางทาง (ห้องถูกจองแล้ว): ยกเลิกทั้งชุดด้วยข้อความเดียว', async () => {
    setRoomG()
    insertErrors = [undefined, wrappedPgError('23P01', G_EXCLUSIVE_VIOLATION)]

    const result = await createReservations(
      [
        { roomId: 'room-g', date: MONDAY, startTime: '08:30', endTime: '10:30' },
        { roomId: 'room-g', date: MONDAY, startTime: '12:30', endTime: '14:30' },
      ],
      'u1',
      { now: BEFORE_OPEN, generateCode: codeSequence(['111111', '222222']) },
    )

    expect(result).toEqual({ ok: false, message: ROOM_TAKEN_MESSAGE })
    // ทั้งชุดทำงานใน transaction เดียว → throw ออกจาก callback เพื่อ rollback
    expect(transactionMock).toHaveBeenCalledTimes(1)
  })

  // ---- การแย่งรหัสกับทรานแซกชันอื่น (23505) ต้องไม่ทำให้ทั้งคำขอเป็น 500 ----

  it('รหัสถูกแย่งไปหลัง pre-assign (23505): rollback ทั้งชุดแล้วสุ่มรหัสใหม่ทั้งชุดจนสำเร็จ', async () => {
    setRoomG()
    // มีคนจองรหัสที่เรา pre-assign ไปได้ก่อน (race) — insert แรกของความพยายามแรกชน 23505
    insertErrors = [
      wrappedPgError(
        '23505',
        'duplicate key value violates unique constraint "reservation_code_per_day"',
      ),
    ]

    const result = await createReservations(
      [
        { roomId: 'room-g', date: MONDAY, startTime: '08:30', endTime: '10:30' },
        { roomId: 'room-g', date: MONDAY, startTime: '12:30', endTime: '14:30' },
      ],
      'u1',
      { now: BEFORE_OPEN, generateCode: codeSequence(['111111', '222222', '333333', '444444']) },
    )

    expect(result).toEqual({ ok: true, bookingCodes: ['333333', '444444'] })
    // ความพยายามแรกล้มทั้งชุด (rollback) แล้วเริ่มทรานแซกชันใหม่ด้วยรหัสชุดใหม่
    expect(transactionMock).toHaveBeenCalledTimes(2)
  })

  it('รหัสถูกแย่งซ้ำทุกความพยายาม: คืนข้อความสร้างรหัสไม่ได้ ไม่โยนทิ้ง (ไม่ใช่ 500)', async () => {
    setRoomG()
    insertErrors = Array.from({ length: 5 }, () =>
      wrappedPgError(
        '23505',
        'duplicate key value violates unique constraint "reservation_code_per_day"',
      ),
    )
    let next = 0
    const generateCode = () => String(100000 + next++)

    const result = await createReservations(
      [
        { roomId: 'room-g', date: MONDAY, startTime: '08:30', endTime: '10:30' },
        { roomId: 'room-g', date: MONDAY, startTime: '12:30', endTime: '14:30' },
      ],
      'u1',
      { now: BEFORE_OPEN, generateCode },
    )

    expect(result).toEqual({
      ok: false,
      message: 'ไม่สามารถสร้างรหัสการจองได้ กรุณาลองใหม่อีกครั้ง',
    })
    // พยายามครบจำนวนสูงสุดแล้วยอมแพ้ด้วยข้อความ friendly ไม่ปล่อย 23505 ออกไปเป็น 500
    expect(transactionMock).toHaveBeenCalledTimes(5)
  })
})

describe('submitBookingSelection (รวมบล็อกเป็น record แล้วจอง)', () => {
  it('บล็อกติดกัน: รวมเป็น record เดียว → รหัสเดียว', async () => {
    const result = await submitBookingSelection(
      {
        roomId: 'room-s',
        date: MONDAY,
        blocks: [
          { start: '08:30', end: '09:30' },
          { start: '09:30', end: '10:30' },
        ],
      },
      'u1',
      { now: BEFORE_OPEN, generateCode: codeSequence(['123456']) },
    )

    expect(result).toEqual({ ok: true, bookingCodes: ['123456'] })
    expect(insertedValues).toHaveLength(1)
    expect(insertedValues[0]).toMatchObject({
      startTime: new Date('2026-10-19T01:30:00Z'), // 08:30 Bangkok
      endTime: new Date('2026-10-19T03:30:00Z'), // 10:30 Bangkok
    })
  })

  it('บล็อกที่มีช่องว่าง: แยก record → ได้หลายรหัสตามจำนวน record', async () => {
    const result = await submitBookingSelection(
      {
        roomId: 'room-s',
        date: MONDAY,
        blocks: [
          { start: '08:30', end: '09:30' },
          { start: '10:30', end: '11:30' },
        ],
      },
      'u1',
      { now: BEFORE_OPEN, generateCode: codeSequence(['111111', '222222']) },
    )

    expect(result).toEqual({ ok: true, bookingCodes: ['111111', '222222'] })
    expect(insertedValues).toHaveLength(2)
  })

  it('ยังไม่เลือกบล็อก: ปฏิเสธด้วยข้อความให้เลือกก่อน', async () => {
    const result = await submitBookingSelection(
      { roomId: 'room-s', date: MONDAY, blocks: [] },
      'u1',
      { now: BEFORE_OPEN },
    )

    expect(result).toEqual({ ok: false, message: NO_BLOCK_MESSAGE })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('ห้อง G บล็อกละ 2 ชั่วโมง: เลือกบล็อกเดียว 08:30–10:30 สำเร็จ (ไม่ต้องเลือก 2 บล็อก)', async () => {
    setRoomG()

    const result = await submitBookingSelection(
      {
        roomId: 'room-g',
        date: MONDAY,
        blocks: [{ start: '08:30', end: '10:30' }],
      },
      'u1',
      { now: BEFORE_OPEN, generateCode: codeSequence(['111111']) },
    )

    expect(result).toEqual({ ok: true, bookingCodes: ['111111'] })
    expect(insertedValues).toHaveLength(1)
  })
})
