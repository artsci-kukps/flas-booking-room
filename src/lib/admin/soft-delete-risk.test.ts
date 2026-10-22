import { readFileSync } from 'node:fs'

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { fakeDb } = await import('@/test/fake-booking-db')
  return { default: fakeDb }
})

import { insertRaw, resetFakeDb, seed, tableRows, tables } from '@/test/fake-booking-db'

import { bangkokInstant } from '@/lib/booking/day-availability'

import { createRoom, restoreRoom, softDeleteRoom, updateRoom } from './rooms'
import { restoreRoomType, softDeleteRoomType } from './room-types'

/**
 * ชุดทดสอบพฤติกรรมเสี่ยง (#15) — soft delete / restore ของห้องและประเภทห้อง
 *
 * ใช้ production จริง (rooms.ts / room-types.ts) ทับ mock `@/db` ที่จำลอง
 * trigger `room_type_guard_delete` และ partial unique index ตาม migration 0001
 * เป้าหมาย: ลบ/กู้คืนต้อง "คงแถวเดิม" (id เดิม) เพื่อรักษา FK ของประวัติการจอง
 * และห้ามลบประเภทห้องที่ยังมีห้องใช้งาน (บังคับที่ DB)
 */

const { roomType: roomTypeTable, rooms: roomsTable, reservation: reservationTable } = tables

const MONDAY = '2026-10-19'
const GUARD_MESSAGE = 'ลบไม่ได้เพราะยังมีห้องที่ใช้งานอยู่ภายใต้ประเภทนี้ กรุณาย้ายหรือลบห้องเหล่านั้นก่อน'

function seedRoomType() {
  seed(roomTypeTable, [
    {
      id: 'rt-s',
      code: 'S',
      typeName: 'ห้องทั่วไป',
      bookingMode: 'CAPACITY',
      minDurationMinutes: 60,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      deletedAt: null,
      deletedBy: null,
    },
  ])
}

function seedRoom(id = 'room-s') {
  seed(roomsTable, [
    {
      id,
      name: id,
      roomTypeId: 'rt-s',
      maxCapacity: 4,
      facilities: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      deletedAt: null,
      deletedBy: null,
    },
  ])
}

function reservationRows() {
  return tableRows(reservationTable)
}

beforeEach(() => {
  resetFakeDb()
  seedRoomType()
  seedRoom()
})

describe('migration: trigger กันลบประเภทห้องที่ยังมีห้องใช้งาน', () => {
  const migration = readFileSync(
    new URL('../../../drizzle/0001_reservation_rules.sql', import.meta.url),
    'utf8',
  )

  it('มี trigger room_type_guard_delete ที่โยน restrict_violation เมื่อยังมีห้องใช้งาน', () => {
    expect(migration).toContain('room_type_guard_delete')
    expect(migration).toContain('still has active rooms')
    expect(migration).toContain('restrict_violation')
  })
})

describe('soft delete / restore ห้อง', () => {
  it('ลบห้องแบบ soft delete: แถวห้องยังอยู่ (id เดิม) และการจองในประวัติยังชี้ห้องเดิม', async () => {
    insertRaw(reservationTable, {
      bookingCode: '111111',
      userId: 'u1',
      roomId: 'room-s',
      startTime: bangkokInstant(MONDAY, '09:30'),
      endTime: bangkokInstant(MONDAY, '10:30'),
      status: 'COMPLETED',
    })
    const before = reservationRows()[0]!

    const result = await softDeleteRoom('room-s', 'a1')

    expect(result).toEqual({ ok: true })
    const rooms = tableRows(roomsTable)
    expect(rooms).toHaveLength(1)
    expect(rooms[0]!.id).toBe('room-s')
    expect(rooms[0]!.deletedAt).toBeInstanceOf(Date)
    expect(rooms[0]!.deletedBy).toBe('a1')

    // FK ของประวัติการจองไม่ถูกแตะ — ยังชี้แถวห้องเดิม
    const after = reservationRows()[0]!
    expect(after.id).toBe(before.id)
    expect(after.roomId).toBe('room-s')
  })

  it('กู้คืนห้องด้วยชื่อเดิม: นำแถวเดิมกลับมาใช้ (id เดิม ไม่สร้างแถวใหม่)', async () => {
    await softDeleteRoom('room-s', 'a1')

    const result = await createRoom({
      name: 'room-s',
      roomTypeId: 'rt-s',
      maxCapacity: 4,
      facilities: null,
    })

    expect(result).toEqual({ ok: true, restored: true })
    const rooms = tableRows(roomsTable)
    expect(rooms).toHaveLength(1)
    expect(rooms[0]!.id).toBe('room-s')
    expect(rooms[0]!.deletedAt).toBeNull()
  })

  it('กู้คืนด้วย restoreRoom: id เดิมและประวัติยังเชื่อมโยงอยู่', async () => {
    insertRaw(reservationTable, {
      bookingCode: '222222',
      userId: 'u1',
      roomId: 'room-s',
      startTime: bangkokInstant(MONDAY, '10:30'),
      endTime: bangkokInstant(MONDAY, '11:30'),
      status: 'PENDING',
    })
    await softDeleteRoom('room-s', 'a1')

    const restored = await restoreRoom('room-s')

    expect(restored).toEqual({ ok: true, restored: true })
    expect(tableRows(roomsTable)[0]!.id).toBe('room-s')
    expect(tableRows(roomsTable)[0]!.deletedAt).toBeNull()
    expect(reservationRows()[0]!.roomId).toBe('room-s')
  })

  it('แก้ไขห้องที่ถูกลบไปแล้วถูกปฏิเสธ (ไม่ปลดลบโดยไม่ตั้งใจ)', async () => {
    await softDeleteRoom('room-s', 'a1')

    const result = await updateRoom('room-s', {
      name: 'room-s',
      roomTypeId: 'rt-s',
      maxCapacity: 4,
      facilities: null,
    })

    expect(result.ok).toBe(false)
    expect(tableRows(roomsTable)[0]!.deletedAt).toBeInstanceOf(Date)
  })
})

describe('soft delete / restore ประเภทห้อง', () => {
  it('ลบประเภทห้องที่ยังมีห้องใช้งาน: ถูกปฏิเสธด้วยข้อความไทย และประเภทห้องยังใช้งานอยู่', async () => {
    const result = await softDeleteRoomType('rt-s', 'a1')

    expect(result).toEqual({ ok: false, message: GUARD_MESSAGE })
    const [type] = tableRows(roomTypeTable)
    expect(type!.deletedAt).toBeNull()
    expect(type!.deletedBy).toBeNull()
  })

  it('ลบประเภทห้องได้เมื่อไม่มีห้องใช้งานแล้ว: คงแถวเดิมไว้ (soft delete)', async () => {
    await softDeleteRoom('room-s', 'a1')

    const result = await softDeleteRoomType('rt-s', 'a1')

    expect(result).toEqual({ ok: true })
    const [type] = tableRows(roomTypeTable)
    expect(type!.id).toBe('rt-s')
    expect(type!.deletedAt).toBeInstanceOf(Date)
    expect(type!.deletedBy).toBe('a1')
  })

  it('กู้คืนประเภทห้อง: id เดิมและห้องที่เคยอยู่ใต้ประเภทนี้ยังเชื่อมโยงได้', async () => {
    await softDeleteRoom('room-s', 'a1')
    await softDeleteRoomType('rt-s', 'a1')

    const result = await restoreRoomType('rt-s')

    expect(result).toEqual({ ok: true, restored: true })
    const [type] = tableRows(roomTypeTable)
    expect(type!.id).toBe('rt-s')
    expect(type!.deletedAt).toBeNull()

    // กู้คืนห้องได้อีกครั้งหลังประเภทห้องกลับมาใช้งาน
    const room = await restoreRoom('room-s')
    expect(room).toEqual({ ok: true, restored: true })
    expect(tableRows(roomsTable)[0]!.roomTypeId).toBe('rt-s')
  })
})
