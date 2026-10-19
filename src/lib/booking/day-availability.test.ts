import { beforeEach, describe, expect, it, vi } from 'vitest'

import { holiday as holidayTable, reservation as reservationTable, roomBlock as roomBlockTable, rooms as roomsTable, servicePeriod as servicePeriodTable } from '@/db/schema'
import { makeHoliday, makeRoom, makeServicePeriod } from '@/lib/admin/test-fixtures'

import { buildDaySlots, computeRoomSlots, getDayAvailability, parseBookingDate, resolveDayServiceWindow, shiftBookingDate } from './day-availability'

/**
 * จำลอง query ของ drizzle ให้ "await ได้" และต่อ .where()/.orderBy()/.innerJoin() ได้ทุกแบบ
 * คืนแถวตามตารางที่เรียก (rowsByTable) เพื่อให้ทั้ง helper ที่ reuse และตัว loader ใช้ mock เดียวกัน
 */
function chainQuery(rows: unknown[]) {
  const query = {
    orderBy: () => Promise.resolve(rows),
    innerJoin: () => query,
    where: () => query,
    then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  }
  return query
}

const { fromMock, selectMock } = vi.hoisted(() => {
  const fromMock = vi.fn()
  const selectMock = vi.fn(() => ({ from: fromMock }))
  return { fromMock, selectMock }
})

vi.mock('@/db', () => ({
  default: { select: selectMock },
}))

/** แถวที่ db.select().from(table) แต่ละตารางจะคืน */
const rowsByTable = new Map<unknown, unknown[]>()

function setTableRows(table: unknown, rows: unknown[]) {
  rowsByTable.set(table, rows)
}

beforeEach(() => {
  vi.clearAllMocks()
  rowsByTable.clear()
  fromMock.mockImplementation((table: unknown) => chainQuery(rowsByTable.get(table) ?? []))
})

/**
 * ทดสอบการคำนวณเวลาเปิด–ปิดของวัน ตาม TOR ข้อ 5.1–5.2
 * วันเสาร์–อาทิตย์และวันหยุด = ปิดทั้งระบบ, EXAM ทับ NORMAL, สร้างล่าสุดชนะ
 */

// ตัวอย่างวันจริง: 2026-10-17 = เสาร์, 2026-10-18 = อาทิตย์, 2026-10-19 = จันทร์
const SATURDAY = '2026-10-17'
const SUNDAY = '2026-10-18'
const MONDAY = '2026-10-19'

describe('resolveDayServiceWindow', () => {
  it('วันเสาร์–อาทิตย์ปิดทั้งระบบ แม้จะมีช่วงเวลาที่มีผล', () => {
    const periods = [makeServicePeriod({ id: 'sp-1' })] // NORMAL 08:30–16:30 มีผลต่อเนื่อง

    expect(resolveDayServiceWindow(SATURDAY, periods, [])).toEqual({
      open: false,
      reason: 'weekend',
      holidayName: null,
    })
    expect(resolveDayServiceWindow(SUNDAY, periods, [])).toEqual({
      open: false,
      reason: 'weekend',
      holidayName: null,
    })
  })

  it('วันหยุดนักขัตฤกษ์ปิดทั้งระบบ พร้อมชื่อวันหยุดสำหรับแสดงผล', () => {
    const periods = [makeServicePeriod({ id: 'sp-1' })]
    const holidays = [makeHoliday({ id: 'h-1', holidayDate: MONDAY, name: 'วันปิยมหาราช' })]

    expect(resolveDayServiceWindow(MONDAY, periods, holidays)).toEqual({
      open: false,
      reason: 'holiday',
      holidayName: 'วันปิยมหาราช',
    })
  })

  it('วันทำการปกติใช้ช่วง NORMAL 08:30–16:30', () => {
    const periods = [makeServicePeriod({ id: 'sp-1' })]

    expect(resolveDayServiceWindow(MONDAY, periods, [])).toEqual({
      open: true,
      kind: 'NORMAL',
      openTime: '08:30',
      closeTime: '16:30',
    })
  })

  it('เมื่อมี EXAM ทับ NORMAL ใช้เวลาของช่วงสอบ', () => {
    const periods = [
      makeServicePeriod({ id: 'sp-normal' }),
      makeServicePeriod({
        id: 'sp-exam',
        name: 'midterm',
        kind: 'EXAM',
        openTime: '08:30',
        closeTime: '20:30',
        createdAt: new Date('2026-02-01T00:00:00Z'),
      }),
    ]

    expect(resolveDayServiceWindow(MONDAY, periods, [])).toEqual({
      open: true,
      kind: 'EXAM',
      openTime: '08:30',
      closeTime: '20:30',
    })
  })

  it('ปิดเมื่อไม่มีช่วงเวลาใดมีผลในวันนั้น', () => {
    const periods = [
      makeServicePeriod({ id: 'sp-1', effectiveFrom: '2027-01-01', effectiveTo: '2027-01-31' }),
    ]

    expect(resolveDayServiceWindow(MONDAY, periods, [])).toEqual({
      open: false,
      reason: 'no-service-period',
      holidayName: null,
    })
  })
})

describe('buildDaySlots', () => {
  it('แตกช่องว่าง 1 ชั่วโมงเริ่มจากเวลาเปิดของวันนั้น (NORMAL 08:30–16:30)', () => {
    // ตัวอย่าง TOR ข้อ 5.3: 08:30–09:30, 09:30–10:30, … , 15:30–16:30
    const slots = buildDaySlots('08:30', '16:30')

    expect(slots).toHaveLength(8)
    expect(slots[0]).toEqual({ start: '08:30', end: '09:30' })
    expect(slots.at(-1)).toEqual({ start: '15:30', end: '16:30' })
  })

  it('ช่วงสอบ 08:30–20:30 ได้ 12 ช่อง จบลงที่ 19:30–20:30 พอดี', () => {
    const slots = buildDaySlots('08:30', '20:30')

    expect(slots).toHaveLength(12)
    expect(slots.at(-1)).toEqual({ start: '19:30', end: '20:30' })
  })

  it('ทิ้งเศษช่วงที่เกินเวลาปิด (slot ต้องอยู่ครบในเวลาให้บริการ)', () => {
    // 08:45 + 1 ชม. ไปจบทะลุ 16:30 ช่องสุดท้ายจึงจบลงที่ 14:45–15:45
    const slots = buildDaySlots('08:45', '16:30')

    expect(slots[0]).toEqual({ start: '08:45', end: '09:45' })
    expect(slots.at(-1)).toEqual({ start: '14:45', end: '15:45' })
    expect(slots.every((slot) => slot.end <= '16:30')).toBe(true)
  })

  it('คืนว่างเมื่อเวลาเปิดไม่ก่อนเวลาปิด', () => {
    expect(buildDaySlots('16:30', '08:30')).toEqual([])
  })

  it('บล็อกยาวตามที่กำหนด: ห้อง G ใช้บล็อก 2 ชั่วโมง (08:30–16:30 → 4 บล็อก)', () => {
    const slots = buildDaySlots('08:30', '16:30', 120)

    expect(slots).toHaveLength(4)
    expect(slots[0]).toEqual({ start: '08:30', end: '10:30' })
    expect(slots.at(-1)).toEqual({ start: '14:30', end: '16:30' })
  })

  it('ทิ้งเศษที่เกินเวลาปิดเมื่อบล็อก 2 ชั่วโมง (08:30–15:30 → 3 บล็อก)', () => {
    const slots = buildDaySlots('08:30', '15:30', 120)

    expect(slots.map((slot) => `${slot.start}-${slot.end}`)).toEqual([
      '08:30-10:30',
      '10:30-12:30',
      '12:30-14:30',
    ])
  })
})

describe('computeRoomSlots', () => {
  // วันทดสอบ: 2026-10-19 (จันทร์) — ช่องว่าง 09:00, 10:00, 11:00 ที่ส่งเข้าไปโดยตรง
  const DATE = '2026-10-19'
  const SLOTS = [
    { start: '09:00', end: '10:00' },
    { start: '10:00', end: '11:00' },
    { start: '11:00', end: '12:00' },
  ]
  const BEFORE_OPEN = new Date('2026-10-19T01:00:00Z') // 08:00 Bangkok

  it('ห้อง EXCLUSIVE: ช่องว่าง = free เลือกได้, มีการจองครอง = occupied เลือกไม่ได้', () => {
    const slots = computeRoomSlots({
      date: DATE,
      slots: SLOTS,
      bookingMode: 'EXCLUSIVE',
      maxCapacity: null,
      reservations: [
        { startTime: new Date('2026-10-19T03:15:00Z'), endTime: new Date('2026-10-19T04:45:00Z') }, // 10:15–11:45
      ],
      blocks: [],
      now: BEFORE_OPEN,
    })

    expect(slots).toEqual([
      { start: '09:00', end: '10:00', status: 'free', usedCount: 0, past: false, selectable: true },
      { start: '10:00', end: '11:00', status: 'occupied', usedCount: 1, past: false, selectable: false },
      { start: '11:00', end: '12:00', status: 'occupied', usedCount: 1, past: false, selectable: false },
    ])
  })

  it('ห้อง CAPACITY: แสดงจำนวนที่ใช้เทียบ max_capacity และเลือกได้จนเต็มความจุ', () => {
    const slots = computeRoomSlots({
      date: DATE,
      slots: SLOTS,
      bookingMode: 'CAPACITY',
      maxCapacity: 3,
      reservations: [
        { startTime: new Date('2026-10-19T03:15:00Z'), endTime: new Date('2026-10-19T04:00:00Z') }, // 10:15–11:00
        { startTime: new Date('2026-10-19T03:30:00Z'), endTime: new Date('2026-10-19T04:30:00Z') }, // 10:30–11:30
        { startTime: new Date('2026-10-19T04:15:00Z'), endTime: new Date('2026-10-19T05:00:00Z') }, // 11:15–12:00
        { startTime: new Date('2026-10-19T04:45:00Z'), endTime: new Date('2026-10-19T05:30:00Z') }, // 11:45–12:30
      ],
      blocks: [],
      now: BEFORE_OPEN,
    })

    // ช่อง 10:00 มี 2 จาก 3 ยังเลือกได้, ช่อง 11:00 เต็ม 3/3 เลือกไม่ได้
    expect(slots[1]).toEqual({ start: '10:00', end: '11:00', status: 'occupied', usedCount: 2, past: false, selectable: true })
    expect(slots[2]).toEqual({ start: '11:00', end: '12:00', status: 'occupied', usedCount: 3, past: false, selectable: false })
  })

  it('การจองที่จบลงตรงขอบซ้าย หรือเริ่มตรงขอบขวาของช่อง ไม่นับว่าซ้อน ([) )', () => {
    const slots = computeRoomSlots({
      date: DATE,
      slots: SLOTS,
      bookingMode: 'EXCLUSIVE',
      maxCapacity: null,
      reservations: [
        { startTime: new Date('2026-10-19T01:00:00Z'), endTime: new Date('2026-10-19T02:00:00Z') }, // 08:00–09:00
        { startTime: new Date('2026-10-19T05:00:00Z'), endTime: new Date('2026-10-19T06:00:00Z') }, // 12:00–13:00
      ],
      blocks: [],
      now: BEFORE_OPEN,
    })

    expect(slots[0]!.status).toBe('free')
    expect(slots[0]!.usedCount).toBe(0)
    expect(slots[2]!.status).toBe('free')
    expect(slots[2]!.usedCount).toBe(0)
  })

  it('ห้ามเลือกช่องที่ถูกบล็อกห้อง และบล็อกเด่นกว่าการจองเมื่อแสดงผล', () => {
    const slots = computeRoomSlots({
      date: DATE,
      slots: SLOTS,
      bookingMode: 'EXCLUSIVE',
      maxCapacity: null,
      reservations: [
        { startTime: new Date('2026-10-19T03:15:00Z'), endTime: new Date('2026-10-19T04:00:00Z') }, // 10:15–11:00
      ],
      blocks: [
        { startTime: new Date('2026-10-19T02:30:00Z'), endTime: new Date('2026-10-19T04:00:00Z') }, // 09:30–11:00
      ],
      now: BEFORE_OPEN,
    })

    expect(slots[0]).toEqual({ start: '09:00', end: '10:00', status: 'blocked', usedCount: 0, past: false, selectable: false })
    expect(slots[1]).toEqual({ start: '10:00', end: '11:00', status: 'blocked', usedCount: 1, past: false, selectable: false })
    expect(slots[2]!.status).toBe('free') // บล็อกจบ exactly 11:00 — ช่วง [) ชนกันตรงขอบไม่นับซ้อน
  })

  it('บล็อกที่ครอบช่องบางส่วนก็ถือว่าช่องนั้นถูกบล็อก', () => {
    const slots = computeRoomSlots({
      date: DATE,
      slots: SLOTS,
      bookingMode: 'EXCLUSIVE',
      maxCapacity: null,
      reservations: [],
      blocks: [
        { startTime: new Date('2026-10-19T04:30:00Z'), endTime: new Date('2026-10-19T05:30:00Z') }, // 11:30–12:30
      ],
      now: BEFORE_OPEN,
    })

    expect(slots[2]).toEqual({ start: '11:00', end: '12:00', status: 'blocked', usedCount: 0, past: false, selectable: false })
  })

  it('ช่องที่ผ่านไปแล้วของวันนี้ไม่สามารถเลือกได้ แม้จะว่างก็ตาม', () => {
    const now = new Date('2026-10-19T03:30:00Z') // 10:30 Bangkok

    const slots = computeRoomSlots({
      date: DATE,
      slots: SLOTS,
      bookingMode: 'EXCLUSIVE',
      maxCapacity: null,
      reservations: [],
      blocks: [],
      now,
    })

    expect(slots[0]).toEqual({ start: '09:00', end: '10:00', status: 'free', usedCount: 0, past: true, selectable: false })
    expect(slots[1]).toEqual({ start: '10:00', end: '11:00', status: 'free', usedCount: 0, past: true, selectable: false })
    expect(slots[2]).toEqual({ start: '11:00', end: '12:00', status: 'free', usedCount: 0, past: false, selectable: true })
  })

  it('วันอื่นที่ไม่ใช่วันนี้ ช่องทั้งหมดยังไม่ผ่าน (เลือกได้ตามสถานะ)', () => {
    const now = new Date('2026-10-19T03:30:00Z') // วันนี้ 10:30

    const slots = computeRoomSlots({
      date: '2026-10-20', // พรุ่งนี้
      slots: SLOTS,
      bookingMode: 'EXCLUSIVE',
      maxCapacity: null,
      reservations: [],
      blocks: [],
      now,
    })

    expect(slots.every((slot) => !slot.past)).toBe(true)
    expect(slots.every((slot) => slot.selectable)).toBe(true)
  })
})

describe('getDayAvailability', () => {
  const MONDAY = '2026-10-19'
  const NOW_0800 = new Date('2026-10-19T01:00:00Z') // 08:00 Bangkok

  it('วันเสาร์คืนผลปิด และไม่ดึงห้อง/การจอง/บล็อก (หน้าจึงโหลดเร็วไม่รอข้อมูลส่วนอื่น)', async () => {
    setTableRows(servicePeriodTable, [makeServicePeriod({ id: 'sp-1' })])
    setTableRows(holidayTable, [])

    const result = await getDayAvailability('2026-10-17', NOW_0800)

    expect(result).toEqual({
      date: '2026-10-17',
      open: false,
      reason: 'weekend',
      holidayName: null,
    })

    const queriedTables = fromMock.mock.calls.map(([table]) => table)
    expect(queriedTables).not.toContain(roomsTable)
    expect(queriedTables).not.toContain(reservationTable)
    expect(queriedTables).not.toContain(roomBlockTable)
  })

  it('วันทำการคืนห้องที่ยังใช้งานพร้อมช่องว่าง สถานะคำนวณจากการจองและบล็อกของวันนั้น', async () => {
    setTableRows(servicePeriodTable, [makeServicePeriod({ id: 'sp-1' })])
    setTableRows(holidayTable, [])
    setTableRows(roomsTable, [
      makeRoom({ id: 'room-s', name: 'S-101', bookingMode: 'CAPACITY', maxCapacity: 4 }),
      makeRoom({ id: 'room-g', name: 'G-101', roomTypeCode: 'G', roomTypeName: 'ห้องประชุมใหญ่', bookingMode: 'EXCLUSIVE', maxCapacity: null, minDurationMinutes: 120 }),
    ])
    setTableRows(reservationTable, [
      { roomId: 'room-s', startTime: new Date('2026-10-19T03:15:00Z'), endTime: new Date('2026-10-19T04:00:00Z') }, // 10:15–11:00
    ])
    setTableRows(roomBlockTable, [
      { roomId: 'room-g', startTime: new Date('2026-10-19T01:45:00Z'), endTime: new Date('2026-10-19T02:30:00Z') }, // 08:45–09:30
    ])

    const result = await getDayAvailability(MONDAY, NOW_0800)

    expect(result.open).toBe(true)
    if (!result.open) return

    expect(result.kind).toBe('NORMAL')
    expect(result.openTime).toBe('08:30')
    expect(result.closeTime).toBe('16:30')
    // บล็อกเวลาคำนวณแยกต่อห้องตามความยาวของประเภทห้อง (ตรวจด้านล่าง)

    expect(result.rooms.map((room) => room.name)).toEqual(['S-101', 'G-101'])

    // ระยะเวลาขั้นต่ำตามประเภทห้องต้องมาถึง UI เพื่อเตือนก่อนกดยืนยัน (TOR ข้อ 4)
    expect(result.rooms[0]!.minDurationMinutes).toBe(60)
    expect(result.rooms[1]!.minDurationMinutes).toBe(120)

    const roomS = result.rooms[0]!
    // 09:30–10:30 และ 10:30–11:30 ทับการจอง 10:15–11:00 (มี 1 จาก 4 ที่นั่ง ยังเลือกได้)
    expect(roomS.slots[1]).toMatchObject({ start: '09:30', status: 'occupied', usedCount: 1, selectable: true })
    expect(roomS.slots[3]).toMatchObject({ start: '11:30', status: 'free', selectable: true })

    const roomG = result.rooms[1]!
    expect(roomG.slots[0]).toMatchObject({ start: '08:30', end: '10:30', status: 'blocked', selectable: false })
    expect(roomG.slots[1]).toMatchObject({ start: '10:30', end: '12:30', status: 'free', selectable: true })
  })

  it('บล็อกเวลาต่างกันตามประเภทห้อง: G (ขั้นต่ำ 120) บล็อกละ 2 ชม., S (60) บล็อกละ 1 ชม.', async () => {
    setTableRows(servicePeriodTable, [makeServicePeriod({ id: 'sp-1' })])
    setTableRows(holidayTable, [])
    setTableRows(roomsTable, [
      makeRoom({ id: 'room-s', name: 'S-101', bookingMode: 'CAPACITY', maxCapacity: 4 }),
      makeRoom({
        id: 'room-g',
        name: 'G-101',
        roomTypeCode: 'G',
        roomTypeName: 'ห้องประชุมใหญ่',
        bookingMode: 'EXCLUSIVE',
        maxCapacity: null,
        minDurationMinutes: 120,
      }),
    ])
    setTableRows(reservationTable, [])
    setTableRows(roomBlockTable, [])

    const result = await getDayAvailability(MONDAY, NOW_0800)

    expect(result.open).toBe(true)
    if (!result.open) return

    const roomS = result.rooms[0]!
    const roomG = result.rooms[1]!

    // S: 1 ชั่วโมง → 8 บล็อกตลอดวันทำการปกติ
    expect(roomS.slots.map((slot) => `${slot.start}-${slot.end}`)).toEqual([
      '08:30-09:30',
      '09:30-10:30',
      '10:30-11:30',
      '11:30-12:30',
      '12:30-13:30',
      '13:30-14:30',
      '14:30-15:30',
      '15:30-16:30',
    ])

    // G: 2 ชั่วโมง → 4 บล็อก
    expect(roomG.slots.map((slot) => `${slot.start}-${slot.end}`)).toEqual([
      '08:30-10:30',
      '10:30-12:30',
      '12:30-14:30',
      '14:30-16:30',
    ])
  })

  it('วันหยุดคืนผลปิดพร้อมชื่อวันหยุด และไม่ดึงข้อมูลห้อง/การจอง/บล็อก', async () => {
    setTableRows(servicePeriodTable, [makeServicePeriod({ id: 'sp-1' })])
    setTableRows(holidayTable, [makeHoliday({ id: 'h-1', holidayDate: MONDAY, name: 'วันปิยมหาราช' })])

    const result = await getDayAvailability(MONDAY, NOW_0800)

    expect(result).toEqual({
      date: MONDAY,
      open: false,
      reason: 'holiday',
      holidayName: 'วันปิยมหาราช',
    })

    const queriedTables = fromMock.mock.calls.map(([table]) => table)
    expect(queriedTables).not.toContain(roomsTable)
  })
})

describe('parseBookingDate', () => {
  it('รับค่า ?date=YYYY-MM-DD ที่เป็นวันที่มีจริงบนปฏิทิน', () => {
    expect(parseBookingDate('2026-10-19')).toBe('2026-10-19')
    expect(parseBookingDate(['2026-10-19', '2026-10-20'])).toBe('2026-10-19') // ใช้ค่าแรกเมื่อซ้ำ
  })

  it('คืน null เมื่อไม่มีค่า รูปแบบผิด หรือวันที่ไม่มีจริง', () => {
    expect(parseBookingDate(undefined)).toBeNull()
    expect(parseBookingDate('')).toBeNull()
    expect(parseBookingDate('19-10-2026')).toBeNull()
    expect(parseBookingDate('not-a-date')).toBeNull()
    expect(parseBookingDate('2026-02-30')).toBeNull()
  })
})

describe('shiftBookingDate', () => {
  it('เลื่อนวันไปข้างหน้า/ถอยหลังข้ามเดือนได้', () => {
    expect(shiftBookingDate('2026-10-19', 1)).toBe('2026-10-20')
    expect(shiftBookingDate('2026-10-19', -1)).toBe('2026-10-18')
    expect(shiftBookingDate('2026-11-01', -1)).toBe('2026-10-31')
    expect(shiftBookingDate('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftBookingDate('2026-10-19', 0)).toBe('2026-10-19')
  })
})
