import { readFileSync } from 'node:fs'

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { fakeDb } = await import('@/test/fake-booking-db')
  return { default: fakeDb }
})

// ไม่ยิง SMTP จริงจากเทสต์ (เส้นทางจองเรียก sendEmail หลัง commit)
vi.mock('@/services/email.service', () => ({
  sendEmail: vi.fn(async () => {}),
}))

import {
  insertRaw,
  maxConcurrentOccupancy,
  resetFakeDb,
  seed,
  tableRows,
  tables,
} from '@/test/fake-booking-db'

import { bangkokInstant } from './day-availability'
import { createReservation, createReservations } from './reservations'

/**
 * ชุดทดสอบพฤติกรรมเสี่ยงครบวงจร (#15) — concurrency, ขอบวัน, รหัส, การจองทับตัวเอง
 *
 * เรียก production จริง (createReservation/createReservations) ทับ mock `@/db`
 * ที่จำลองกติกา DB ตาม migration 0001 (exclusion constraint, unique code-per-day,
 * trigger booking_date, advisory lock ต่อห้อง) — promise หลายตัวแทรกกันที่จุด await
 * แล้วให้ "DB จำลอง" เป็นผู้ตัดสินสุดท้ายเหมือนของจริง
 */

const { holiday: holidayTable, roomType: roomTypeTable, rooms: roomsTable, reservation: reservationTable, servicePeriod: servicePeriodTable } = tables

const MONDAY = '2026-10-19'
const TUESDAY = '2026-10-20'
const BEFORE_MONDAY = new Date('2026-10-18T17:00:00Z') // 00:00 Bangkok ของวันจอง
const BEFORE_TUESDAY = new Date('2026-10-19T17:00:00Z') // 00:00 Bangkok ของวันอังคาร

const ROOM_TAKEN_MESSAGE = 'ช่วงเวลานี้มีผู้ใช้จองห้องนี้แล้ว กรุณาเลือกช่วงเวลาอื่น'
const USER_OVERLAP_MESSAGE = 'คุณมีการจองอื่นที่ทับซ้อนกับช่วงเวลานี้อยู่แล้ว กรุณาเลือกช่วงเวลาอื่น'
const CAPACITY_FULL_MESSAGE = 'ห้องเต็มความจุในช่วงเวลานี้แล้ว กรุณาเลือกช่วงเวลาอื่น'

/** สร้างประเภทห้องหนึ่งประเภท */
function seedRoomType(id: string, code: string, bookingMode: 'CAPACITY' | 'EXCLUSIVE', minDurationMinutes: number) {
  seed(roomTypeTable, [
    {
      id,
      code,
      typeName: `ประเภท ${code}`,
      bookingMode,
      minDurationMinutes,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      deletedAt: null,
      deletedBy: null,
    },
  ])
}

/** สร้างห้องหนึ่งห้องผูกกับประเภทที่ seed ไว้ */
function seedRoom(id: string, roomTypeId: string, maxCapacity: number | null) {
  seed(roomsTable, [
    {
      id,
      name: id,
      roomTypeId,
      maxCapacity,
      facilities: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      deletedAt: null,
      deletedBy: null,
    },
  ])
}

/** เวลาทำการ NORMAL อ้างอิงของทุกเทสต์ (มีผลตลอดปี 2026) */
function seedNormalPeriod() {
  seed(servicePeriodTable, [
    {
      id: 'sp-1',
      name: 'เวลาทำการปกติ',
      kind: 'NORMAL',
      openTime: '08:30',
      closeTime: '16:30',
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    },
  ])
}

/** รหัสสุ่มแบบกำหนดลำดับได้ เพื่อให้ผลทดสอบคงที่ */
function codeSequence(values: string[]): () => string {
  let index = 0

  return () => values[index++] ?? String(900000 + index)
}

function reservations() {
  return tableRows(reservationTable)
}

beforeEach(() => {
  resetFakeDb()
  void holidayTable
  seedNormalPeriod()
})

// ============================================================
// AC: แย่งกันจองห้อง EXCLUSIVE — สำเร็จแค่หนึ่ง (exclusion constraint)
// ============================================================

describe('แย่งกันจองห้อง EXCLUSIVE (exclusion constraint)', () => {
  it('สองคำขอพร้อมกันจองห้องเดียวกันช่วงเดียวกัน: สำเร็จแค่หนึ่ง อีกคำขอได้ข้อความห้องถูกจอง', async () => {
    seedRoomType('rt-g', 'G', 'EXCLUSIVE', 120)
    seedRoom('room-g', 'rt-g', null)

    const request = { roomId: 'room-g', date: MONDAY, startTime: '08:30', endTime: '10:30' }

    const [first, second] = await Promise.all([
      createReservation(request, 'u1', { now: BEFORE_MONDAY, generateCode: () => '111111' }),
      createReservation(request, 'u2', { now: BEFORE_MONDAY, generateCode: () => '222222' }),
    ])

    const succeeded = [first, second].filter((result) => result.ok)
    expect(succeeded).toHaveLength(1)
    expect([first, second].find((result) => !result.ok)).toEqual({
      ok: false,
      message: ROOM_TAKEN_MESSAGE,
    })
    // มีแถวเดียวใน DB — คำขอที่แพ้ไม่ทิ้งข้อมูลครึ่งทาง
    expect(reservations()).toHaveLength(1)
  })

  it('จองห้อง EXCLUSIVE ที่ไม่ทับกันได้ตามปกติ (เฉพาะช่วงทับเท่านั้นที่ถูกกัน)', async () => {
    seedRoomType('rt-p', 'P', 'EXCLUSIVE', 60)
    seedRoom('room-p', 'rt-p', null)

    const first = await createReservation(
      { roomId: 'room-p', date: MONDAY, startTime: '09:30', endTime: '10:30' },
      'u1',
      { now: BEFORE_MONDAY, generateCode: () => '111111' },
    )
    const second = await createReservation(
      { roomId: 'room-p', date: MONDAY, startTime: '10:30', endTime: '11:30' },
      'u2',
      { now: BEFORE_MONDAY, generateCode: () => '222222' },
    )

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(reservations()).toHaveLength(2)
  })
})

// ============================================================
// AC: แย่งกันจองห้อง CAPACITY — ไม่เกิน max_capacity (advisory lock)
// ============================================================

describe('แย่งกันจองห้อง CAPACITY (advisory lock ต่อห้อง)', () => {
  it('ห้าคำขอพร้อมกันจองความจุ 2 ช่วงเดียวกัน: สำเร็จ 2 และจำนวนที่ครองซ้อนไม่เคยเกิน 2', async () => {
    seedRoomType('rt-s', 'S', 'CAPACITY', 60)
    seedRoom('room-s', 'rt-s', 2)

    const request = { roomId: 'room-s', date: MONDAY, startTime: '09:30', endTime: '10:30' }
    const users = ['u1', 'u2', 'u3', 'u4', 'u5']

    const results = await Promise.all(
      users.map((userId, index) =>
        createReservation(request, userId, {
          now: BEFORE_MONDAY,
          generateCode: () => String(100000 + index),
        }),
      ),
    )

    expect(results.filter((result) => result.ok)).toHaveLength(2)
    expect(
      results.filter((result) => !result.ok).every((result) => result.message === CAPACITY_FULL_MESSAGE),
    ).toBe(true)
    // ล็อกแล้วนับก่อน insert ทำให้ไม่มีทางครองเกินความจุ
    expect(maxConcurrentOccupancy('room-s')).toBeLessThanOrEqual(2)
    expect(reservations()).toHaveLength(2)
  })

  it('ความจุ 1: สองคำขอพร้อมกัน สำเร็จหนึ่ง อีกคำขอได้ข้อความห้องเต็ม', async () => {
    seedRoomType('rt-s', 'S', 'CAPACITY', 60)
    seedRoom('room-s', 'rt-s', 1)

    const request = { roomId: 'room-s', date: MONDAY, startTime: '09:30', endTime: '10:30' }

    const [first, second] = await Promise.all([
      createReservation(request, 'u1', { now: BEFORE_MONDAY, generateCode: () => '111111' }),
      createReservation(request, 'u2', { now: BEFORE_MONDAY, generateCode: () => '222222' }),
    ])

    expect([first, second].filter((result) => result.ok)).toHaveLength(1)
    expect([first, second].find((result) => !result.ok)).toEqual({
      ok: false,
      message: CAPACITY_FULL_MESSAGE,
    })
    expect(reservations()).toHaveLength(1)
  })

  it('ครองซ้อนได้เท่าความจุพอดี: คำขอที่สามของช่วงเดียวกันถูกปฏิเสธ', async () => {
    seedRoomType('rt-s', 'S', 'CAPACITY', 60)
    seedRoom('room-s', 'rt-s', 2)

    const request = { roomId: 'room-s', date: MONDAY, startTime: '09:30', endTime: '10:30' }

    await createReservation(request, 'u1', { now: BEFORE_MONDAY, generateCode: () => '111111' })
    await createReservation(request, 'u2', { now: BEFORE_MONDAY, generateCode: () => '222222' })

    const third = await createReservation(request, 'u3', {
      now: BEFORE_MONDAY,
      generateCode: () => '333333',
    })

    expect(third).toEqual({ ok: false, message: CAPACITY_FULL_MESSAGE })
    expect(reservations()).toHaveLength(2)
  })
})

// ============================================================
// AC: ขอบวัน Asia/Bangkok — ไม่พึ่ง timezone ของ server
// ============================================================

describe('ขอบวัน Asia/Bangkok (ไม่พึ่ง timezone ของ server)', () => {
  const migration = readFileSync(
    new URL('../../../drizzle/0001_reservation_rules.sql', import.meta.url),
    'utf8',
  )

  it('trigger เซ็ต booking_date จาก start_time ในเขตเวลา Asia/Bangkok เท่านั้น', () => {
    expect(migration).toContain(
      `NEW."booking_date" := (NEW."start_time" AT TIME ZONE 'Asia/Bangkok')::date`,
    )
  })

  it('bangkokInstant ตรึง +07:00 เสมอ แม้ instant ที่ได้จะตกคนละวัน UTC', () => {
    // 00:00 ของวันที่ 19 ตามเวลาไทย = 17:00 ของวันที่ 18 UTC
    expect(bangkokInstant('2026-10-19', '00:00').toISOString()).toBe('2026-10-18T17:00:00.000Z')
    expect(bangkokInstant('2026-10-19', '08:30').toISOString()).toBe('2026-10-19T01:30:00.000Z')
    // ไม่มี DST — ปลายปีก็ยัง +07:00
    expect(bangkokInstant('2026-12-31', '23:00').toISOString()).toBe('2026-12-31T16:00:00.000Z')
  })

  it('วันเดียวกัน/คนละวันคิดตามปฏิทิน Bangkok: instant คนละวัน UTC แต่วัน Bangkok เดียวกันชนรหัสกัน', () => {
    seedRoomType('rt-p', 'P', 'EXCLUSIVE', 60)
    seedRoom('room-p', 'rt-p', null)

    // A: 2026-10-18 17:30 UTC = 2026-10-19 00:30 Bangkok → booking_date 19
    const a = insertRaw(reservationTable, {
      bookingCode: '111111',
      userId: 'u9',
      roomId: 'room-p',
      startTime: new Date('2026-10-18T17:30:00Z'),
      endTime: new Date('2026-10-18T18:30:00Z'),
      status: 'PENDING',
    })
    expect(a.bookingDate).toBe('2026-10-19')

    // B: 2026-10-18 16:30 UTC = 2026-10-18 23:30 Bangkok → คนละวัน Bangkok แม้วัน UTC เดียวกัน
    const b = insertRaw(reservationTable, {
      bookingCode: '111111',
      userId: 'u9',
      roomId: 'room-p',
      startTime: new Date('2026-10-18T16:30:00Z'),
      endTime: new Date('2026-10-18T17:30:00Z'),
      status: 'PENDING',
    })
    expect(b.bookingDate).toBe('2026-10-18')

    // D: 2026-10-19 01:00 UTC = 2026-10-19 08:00 Bangkok → วัน Bangkok เดียวกับ A (คนละวัน UTC)
    expect(() =>
      insertRaw(reservationTable, {
        bookingCode: '111111',
        userId: 'u9',
        roomId: 'room-p',
        startTime: new Date('2026-10-19T01:00:00Z'),
        endTime: new Date('2026-10-19T02:00:00Z'),
        status: 'PENDING',
      }),
    ).toThrow(/reservation_code_per_day/)
  })
})

// ============================================================
// AC: รหัสการจองซ้ำในวันเดียวถูกสุ่มใหม่, ซ้ำข้ามวันได้
// ============================================================

describe('รหัสการจอง 6 หลัก (unique ต่อวัน)', () => {
  it('รหัสซ้ำกับการจองวันเดียวกัน: สุ่มรหัสใหม่แล้วบันทึกสำเร็จ', async () => {
    seedRoomType('rt-s', 'S', 'CAPACITY', 60)
    seedRoom('room-s', 'rt-s', 4)

    // มีการจองวันเดียวกันใช้ 111111 อยู่แล้ว (ช่วง 08:30–09:30 ไม่ทับช่วงที่จะจอง)
    insertRaw(reservationTable, {
      bookingCode: '111111',
      userId: 'u9',
      roomId: 'room-s',
      startTime: bangkokInstant(MONDAY, '08:30'),
      endTime: bangkokInstant(MONDAY, '09:30'),
      status: 'PENDING',
    })

    const result = await createReservation(
      { roomId: 'room-s', date: MONDAY, startTime: '09:30', endTime: '10:30' },
      'u1',
      { now: BEFORE_MONDAY, generateCode: codeSequence(['111111', '222222']) },
    )

    expect(result).toEqual({ ok: true, bookingCode: '222222' })
    expect(reservations().some((row) => row.bookingCode === '222222')).toBe(true)
  })

  it('รหัสเดียวกันข้ามวัน: ใช้ซ้ำได้เพราะ unique ต่อวันเท่านั้น', async () => {
    seedRoomType('rt-s', 'S', 'CAPACITY', 60)
    seedRoom('room-s', 'rt-s', 4)

    const monday = await createReservation(
      { roomId: 'room-s', date: MONDAY, startTime: '09:30', endTime: '10:30' },
      'u1',
      { now: BEFORE_MONDAY, generateCode: () => '111111' },
    )
    const tuesday = await createReservation(
      { roomId: 'room-s', date: TUESDAY, startTime: '09:30', endTime: '10:30' },
      'u1',
      { now: BEFORE_TUESDAY, generateCode: () => '111111' },
    )

    expect(monday).toEqual({ ok: true, bookingCode: '111111' })
    expect(tuesday).toEqual({ ok: true, bookingCode: '111111' })
    expect(reservations().map((row) => row.bookingDate)).toEqual([MONDAY, TUESDAY])
  })

  it('จองหลาย record พร้อมกันในวันเดียว: แยกคนละรหัสเสมอ', async () => {
    seedRoomType('rt-s', 'S', 'CAPACITY', 60)
    seedRoom('room-s', 'rt-s', 4)

    const result = await createReservations(
      [
        { roomId: 'room-s', date: MONDAY, startTime: '08:30', endTime: '09:30' },
        { roomId: 'room-s', date: MONDAY, startTime: '10:30', endTime: '11:30' },
      ],
      'u1',
      { now: BEFORE_MONDAY, generateCode: codeSequence(['111111', '222222']) },
    )

    expect(result).toEqual({ ok: true, bookingCodes: ['111111', '222222'] })
  })
})

// ============================================================
// AC: ผู้ใช้คนเดียวจองทับตัวเองไม่ได้ทุกประเภทห้อง
// ============================================================

describe('ผู้ใช้คนเดียวจองทับตัวเองไม่ได้ (ทุกประเภทห้อง)', () => {
  it('ห้อง EXCLUSIVE คนละห้อง: ผู้ใช้เดิมจองทับช่วงเดียวกันไม่ได้', async () => {
    seedRoomType('rt-p', 'P', 'EXCLUSIVE', 60)
    seedRoom('room-p1', 'rt-p', null)
    seedRoom('room-p2', 'rt-p', null)

    const first = await createReservation(
      { roomId: 'room-p1', date: MONDAY, startTime: '09:30', endTime: '10:30' },
      'u1',
      { now: BEFORE_MONDAY, generateCode: () => '111111' },
    )
    const second = await createReservation(
      { roomId: 'room-p2', date: MONDAY, startTime: '09:30', endTime: '10:30' },
      'u1',
      { now: BEFORE_MONDAY, generateCode: () => '222222' },
    )

    expect(first.ok).toBe(true)
    expect(second).toEqual({ ok: false, message: USER_OVERLAP_MESSAGE })
    expect(reservations()).toHaveLength(1)
  })

  it('ห้อง CAPACITY คนละห้อง: ผู้ใช้เดิมจองทับช่วงเดียวกันไม่ได้เช่นกัน', async () => {
    seedRoomType('rt-s', 'S', 'CAPACITY', 60)
    seedRoom('room-s1', 'rt-s', 4)
    seedRoom('room-s2', 'rt-s', 4)

    const first = await createReservation(
      { roomId: 'room-s1', date: MONDAY, startTime: '09:30', endTime: '10:30' },
      'u1',
      { now: BEFORE_MONDAY, generateCode: () => '111111' },
    )
    const second = await createReservation(
      { roomId: 'room-s2', date: MONDAY, startTime: '09:30', endTime: '10:30' },
      'u1',
      { now: BEFORE_MONDAY, generateCode: () => '222222' },
    )

    expect(first.ok).toBe(true)
    expect(second).toEqual({ ok: false, message: USER_OVERLAP_MESSAGE })
    expect(reservations()).toHaveLength(1)
  })

  it('ช่วงเวลาที่ชนกันตรงขอบ ([) ) ไม่นับทับ: ผู้ใช้เดิมจองต่อเนื่องกันได้', async () => {
    seedRoomType('rt-p', 'P', 'EXCLUSIVE', 60)
    seedRoom('room-p', 'rt-p', null)

    const first = await createReservation(
      { roomId: 'room-p', date: MONDAY, startTime: '09:30', endTime: '10:30' },
      'u1',
      { now: BEFORE_MONDAY, generateCode: () => '111111' },
    )
    const second = await createReservation(
      { roomId: 'room-p', date: MONDAY, startTime: '10:30', endTime: '11:30' },
      'u1',
      { now: BEFORE_MONDAY, generateCode: () => '222222' },
    )

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(reservations()).toHaveLength(2)
  })
})
