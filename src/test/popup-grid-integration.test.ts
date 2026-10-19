import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * ชุดทดสอบบูรณาการ popup จอง × ตารางจอง (ticket #22, spec #16)
 *
 * ปิด AC ของตั๋วด้วยการเดิน flow จริงครบทั้งเส้นทางในที่ seams ที่สูงที่สุดที่ทำได้:
 *   server action จอง/ยกเลิก (user + admin) → performBookingAction/reservations จริง
 *   → fake DB (กติกา exclusion/unique/advisory lock ตาม migration 0001)
 *   → getDayAvailability (ฟังก์ชันเดียวกับที่หน้าตารางใช้) เห็นช่องไม่ว่าง/กลับมาว่าง
 *   → notification_outbox มีแถว BOOKING_CODE / BOOKING_CANCELLED จริง
 *
 * boundary ที่ mock: `@/db` (fake DB), `@/lib/auth/guards` (ตัวตน),
 * `next/cache` / `next/navigation` (revalidatePath/redirect — แค่บันทึกการเรียก)
 *
 * ข้อที่มีเทสต์คุมอยู่แล้วและไม่เขียนซ้ำ: กติกา concurrency (booking-risk.test.ts),
 * รายละเอียดการเข้าคิวอีเมล (cancellation.test.ts, outbox.test.ts),
 * การเลือกช่อง/ preselect (slot-selection.test.ts, grid-booking-dialog.test.tsx)
 */

const { requireUserMock, requireAdminMock, revalidatePathMock, redirectMock } = vi.hoisted(
  () => ({
    requireUserMock: vi.fn(),
    requireAdminMock: vi.fn(),
    revalidatePathMock: vi.fn(),
    redirectMock: vi.fn(),
  }),
)

vi.mock('@/db', async () => {
  const { fakeDb } = await import('@/test/fake-booking-db')
  return { default: fakeDb }
})
vi.mock('@/lib/auth/guards', () => ({
  requireUser: requireUserMock,
  requireAdmin: requireAdminMock,
}))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))
vi.mock('next/navigation', () => ({ redirect: redirectMock }))

import { notificationOutbox, reservation as reservationTable, users as usersTable } from '@/db/schema'
import { bookRoom as userBookRoom } from '@/app/(protected)/user/booking/actions'
import { bookRoom as adminBookRoom } from '@/app/(protected)/admin/booking/actions'
import { cancelBooking as userCancelBooking } from '@/app/(protected)/user/history/actions'
import { cancelReservationAction as adminCancelAction } from '@/app/(protected)/admin/booking-management/cancel-override-actions'
import { getDayAvailability } from '@/lib/booking/day-availability'
import {
  BOOKING_CANCELLED_EMAIL_TYPE,
  BOOKING_CODE_EMAIL_TYPE,
} from '@/lib/notifications/outbox'

import { resetFakeDb, seed, tableRows, tables } from './fake-booking-db'

const { roomType: roomTypeTable, rooms: roomsTable, servicePeriod: servicePeriodTable } = tables

// วันทดสอบ: จันทร์ 2026-10-19 — ล็อกเวลา "ปัจจุบัน" ไว้ที่ 00:30 Bangkok ของวันจอง
// เพื่อให้ช่องว่างทั้งวันยังไม่ผ่านไปและไม่ขึ้นกับเวลาจริงที่รันเทสต์
const MONDAY = '2026-10-19'
const NOW = new Date('2026-10-18T17:30:00.000Z') // 2026-10-19 00:30 Bangkok

const USER = {
  id: 'u1',
  email: 'somchai@ku.th',
  fullName: 'สมชาย ใจดี',
  imageUrl: null,
  role: 'user' as const,
  isBlocked: false,
}

const OTHER_USER = { ...USER, id: 'u2', email: 'somchai2@ku.th', fullName: 'สมหญิง ใจดี' }

const ADMIN = { ...USER, id: 'a1', email: 'admin@ku.th', fullName: 'แอดมิน ระบบ', role: 'admin' as const }

/** เวลาทำการ NORMAL อ้างอิง (มีผลตลอดปี 2026) — ชุดเดียวกับ booking-risk.test.ts */
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

/** ประเภทห้อง 1 ประเภท (S = CAPACITY 60 นาที, G = EXCLUSIVE 120 นาที) */
function seedRoomType(id: string, code: 'S' | 'G', bookingMode: 'CAPACITY' | 'EXCLUSIVE', minDurationMinutes: number) {
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

function seedRoom(id: string, roomTypeId: string, maxCapacity: number | null) {
  seed(roomsTable, [
    {
      id,
      name: id.toUpperCase(),
      roomTypeId,
      maxCapacity,
      facilities: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      deletedAt: null,
      deletedBy: null,
    },
  ])
}

function form(entries: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value)
  }
  return data
}

/** จองผ่าน action จริงของพื้นที่ — blocks ตามรูปแบบที่ SlotPicker ส่ง (JSON ของ {start,end}) */
function bookForm(roomId: string, blocks: { start: string; end: string }[]) {
  return form({ roomId, date: MONDAY, blocks: JSON.stringify(blocks) })
}

/** ห้องว่างของวันที่มาจาก getDayAvailability (ฟังก์ชันเดียวกับหน้าตาราง) */
async function slotsOf(roomId: string) {
  const availability = await getDayAvailability(MONDAY, NOW)

  if (!availability.open) {
    throw new Error('วันทดสอบควรมีเวลาให้บริการ')
  }

  const room = availability.rooms.find((candidate) => candidate.id === roomId)

  if (!room) {
    throw new Error(`ไม่พบห้อง ${roomId} ในความพร้อมของวัน`)
  }

  return { availability, room }
}

function slotOf(slots: Awaited<ReturnType<typeof slotsOf>>['room'], start: string) {
  const slot = slots.slots.find((candidate) => candidate.start === start)

  if (!slot) {
    throw new Error(`ไม่พบช่อง ${start}`)
  }

  return slot
}

function outboxRows() {
  return tableRows(notificationOutbox)
}

function reservations() {
  return tableRows(reservationTable)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  resetFakeDb()
  seedNormalPeriod()
  seedRoomType('rt-s', 'S', 'CAPACITY', 60)
  seedRoomType('rt-g', 'G', 'EXCLUSIVE', 120)
  seedRoom('room-s', 'rt-s', 2)
  seedRoom('room-g', 'rt-g', null)
  seed(usersTable, [USER, OTHER_USER, ADMIN])
  requireUserMock.mockResolvedValue(USER)
  requireAdminMock.mockResolvedValue(ADMIN)
})

afterEach(() => {
  vi.useRealTimers()
})

// ============================================================
// AC: การจองผ่าน popup ใหม่ทำงานได้ทั้งหน้า user booking และ admin booking
// ============================================================

describe('จองผ่าน popup ของหน้าผู้ใช้ (/user/booking)', () => {
  it('ยืนยันสำเร็จ: พาไปหน้ายืนยันพร้อมรหัส และมีแถว BOOKING_CODE ในคิวอีเมลของผู้จอง', async () => {
    await userBookRoom(null, bookForm('room-s', [{ start: '09:30', end: '10:30' }]))

    const [confirmation] = redirectMock.mock.calls[0] as [string]
    const code = new URLSearchParams(confirmation.split('?')[1]!).get('code')

    expect(confirmation.startsWith('/user/booking/confirmation?')).toBe(true)
    expect(code).toMatch(/^\d{6}$/)

    const queued = outboxRows()
    expect(queued).toHaveLength(1)
    expect(queued[0]).toMatchObject({
      type: BOOKING_CODE_EMAIL_TYPE,
      toEmail: USER.email,
      payload: { bookingCode: code },
    })
  })

  it('จองแล้ว: ตาราง (getDayAvailability) เปลี่ยนช่องนั้นเป็นไม่ว่างทันที ช่องอื่นยังว่าง', async () => {
    await userBookRoom(null, bookForm('room-s', [{ start: '09:30', end: '10:30' }]))

    const { room } = await slotsOf('room-s')

    // ห้อง CAPACITY ความจุ 2: จอง 1 ครั้ง → แสดง "ไม่ว่าง" แต่ยังเลือกจองต่อได้จนเต็มความจุ
    expect(slotOf(room, '09:30')).toMatchObject({ status: 'occupied', usedCount: 1, selectable: true })
    expect(slotOf(room, '08:30')).toMatchObject({ status: 'free', usedCount: 0 })
    expect(slotOf(room, '10:30')).toMatchObject({ status: 'free', usedCount: 0 })
  })

  it('รีเฟรชหน้าผู้ใช้ที่แสดงความพร้อม รวมถึงตารางห้อง (/user/table)', async () => {
    await userBookRoom(null, bookForm('room-s', [{ start: '09:30', end: '10:30' }]))

    expect(revalidatePathMock).toHaveBeenCalledWith('/user/booking')
    expect(revalidatePathMock).toHaveBeenCalledWith('/user/table')
  })
})

describe('จองผ่าน popup ของหน้าแอดมิน (/admin/booking)', () => {
  it('ยืนยันสำเร็จ: พาไปหน้ายืนยันของแอดมิน และห้อง G ถูกจองทันทีในตาราง', async () => {
    await adminBookRoom(null, bookForm('room-g', [{ start: '08:30', end: '10:30' }]))

    const [confirmation] = redirectMock.mock.calls[0] as [string]
    expect(confirmation.startsWith('/admin/booking/confirmation?')).toBe(true)

    const { room } = await slotsOf('room-g')
    expect(slotOf(room, '08:30')).toMatchObject({ status: 'occupied', selectable: false })
  })

  it('รีเฟรชหน้าแอดมินที่แสดงความพร้อม รวมถึงตารางห้อง (/admin/table)', async () => {
    await adminBookRoom(null, bookForm('room-g', [{ start: '08:30', end: '10:30' }]))

    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/booking')
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/table')
  })
})

// ============================================================
// AC: เมื่อคลิกช่องว่างในตารางแล้วจองสำเร็จ ช่องว่างนั้นถูกอัพเดตเป็นไม่ว่างทันที
//     และเมื่อยกเลิก ช่องว่างกลับมาจองได้ใหม่ (ปลดล็อกทันที)
// ============================================================

describe('ยกเลิกการจองปลดล็อกช่องว่างทันที (ผู้ใช้ยกเลิกเอง)', () => {
  it('จองเต็มความจุ → ผู้ใช้ยกเลิกของตัวเอง → ช่องกลับมาจองต่อได้ และมีคิวอีเมลยกเลิก', async () => {
    await userBookRoom(null, bookForm('room-s', [{ start: '09:30', end: '10:30' }]))
    requireUserMock.mockResolvedValue(OTHER_USER)
    await userBookRoom(null, bookForm('room-s', [{ start: '09:30', end: '10:30' }]))

    // เต็มความจุ 2 → เลือกจองช่องนี้ต่อไม่ได้
    const before = await slotsOf('room-s')
    expect(slotOf(before.room, '09:30')).toMatchObject({ status: 'occupied', usedCount: 2, selectable: false })

    // ผู้ใช้คนแรกยกเลิกของตัวเอง
    requireUserMock.mockResolvedValue(USER)
    const [mine] = reservations().filter((row) => row.userId === USER.id)
    const state = await userCancelBooking(null, form({ id: String(mine!.id) }))

    expect(state).toEqual({ ok: true })

    // แถวไม่ครองช่วงเวลาอีก (CANCELLED) → เหลือ 1 จาก 2 → เลือกจองต่อได้ทันที
    const after = await slotsOf('room-s')
    expect(slotOf(after.room, '09:30')).toMatchObject({ status: 'occupied', usedCount: 1, selectable: true })

    // อีเมล: BOOKING_CANCELLED (reason null — ผู้ใช้ยกเลิกเอง)  alongside แถว BOOKING_CODE เดิม
    const cancelled = outboxRows().filter((row) => row.type === BOOKING_CANCELLED_EMAIL_TYPE)
    expect(cancelled).toHaveLength(1)
    expect(cancelled[0]).toMatchObject({ toEmail: USER.email, payload: { reason: null } })
  })

  it('ยกเลิกสำเร็จ: รีเฟรชหน้าประวัติและหน้าที่แสดงความพร้อมทั้งหมด รวมถึงตารางห้อง', async () => {
    await userBookRoom(null, bookForm('room-s', [{ start: '09:30', end: '10:30' }]))
    const [mine] = reservations()

    await userCancelBooking(null, form({ id: String(mine!.id) }))

    expect(revalidatePathMock).toHaveBeenCalledWith('/user/history')
    expect(revalidatePathMock).toHaveBeenCalledWith('/user/table')
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/table')
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/booking-management')
  })
})

describe('แอดมินยกเลิกการจองปลดล็อกช่องว่างทันที', () => {
  it('แอดมินยกเลิกพร้อมเหตุผล → ห้อง G ว่างอีกครั้ง และมีคิวอีเมลยกเลิกพร้อมเหตุผล', async () => {
    await adminBookRoom(null, bookForm('room-g', [{ start: '08:30', end: '10:30' }]))

    const [booking] = reservations()
    const state = await adminCancelAction(
      null,
      form({ id: String(booking!.id), reason: 'ห้องถูกใช้จัดงานสำคัญ' }),
    )

    expect(state).toMatchObject({ ok: true, status: 'CANCELLED' })

    const { room } = await slotsOf('room-g')
    expect(slotOf(room, '08:30')).toMatchObject({ status: 'free', usedCount: 0, selectable: true })

    const cancelled = outboxRows().filter((row) => row.type === BOOKING_CANCELLED_EMAIL_TYPE)
    expect(cancelled).toHaveLength(1)
    expect(cancelled[0]).toMatchObject({
      toEmail: ADMIN.email,
      payload: { reason: 'ห้องถูกใช้จัดงานสำคัญ' },
    })
  })

  it('แอดมินยกเลิก: รีเฟรชหน้าจัดการการจองและตารางห้องทันที', async () => {
    await adminBookRoom(null, bookForm('room-g', [{ start: '08:30', end: '10:30' }]))
    const [booking] = reservations()

    await adminCancelAction(null, form({ id: String(booking!.id), reason: 'เหตุผลทดสอบ' }))

    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/booking-management')
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/table')
    expect(revalidatePathMock).toHaveBeenCalledWith('/user/table')
  })
})

// ============================================================
// AC: กฎการจอง CAPACITY (S) และ EXCLUSIVE (G/P) ยังถูกบังคับอย่างถูกต้อง
// ============================================================

describe('กฎ CAPACITY/EXCLUSIVE ผ่าน popup ใหม่ (server validation ตัวเดิม)', () => {
  it('ห้อง S เต็มความจุ: คนถัดไปจองช่องเดิมผ่าน popup ไม่ได้ แล้วตารางแสดง "ไม่ว่าง"', async () => {
    await userBookRoom(null, bookForm('room-s', [{ start: '09:30', end: '10:30' }]))
    requireUserMock.mockResolvedValue(OTHER_USER)
    await userBookRoom(null, bookForm('room-s', [{ start: '09:30', end: '10:30' }]))

    const third = await adminBookRoom(null, bookForm('room-s', [{ start: '09:30', end: '10:30' }]))

    expect(third).toEqual({ ok: false, message: 'ห้องเต็มความจุในช่วงเวลานี้แล้ว กรุณาเลือกช่วงเวลาอื่น' })
    expect(reservations()).toHaveLength(2) // คนที่สามไม่ถูกบันทึก ไม่มีแถวครึ่งทาง

    const { room } = await slotsOf('room-s')
    expect(slotOf(room, '09:30')).toMatchObject({ status: 'occupied', usedCount: 2, selectable: false })
  })

  it('ห้อง G (EXCLUSIVE): ผู้ใช้คนอื่นจองช่วงเดียวกันผ่าน popup ไม่ได้', async () => {
    await userBookRoom(null, bookForm('room-g', [{ start: '08:30', end: '10:30' }]))

    const second = await adminBookRoom(null, bookForm('room-g', [{ start: '08:30', end: '10:30' }]))

    expect(second).toEqual({
      ok: false,
      message: 'ช่วงเวลานี้มีผู้ใช้จองห้องนี้แล้ว กรุณาเลือกช่วงเวลาอื่น',
    })
    expect(reservations()).toHaveLength(1)
  })

  it('ห้อง G (EXCLUSIVE): จองทับตัวเองไม่ได้เช่นกัน (ผู้ใช้คนเดียวกัน)', async () => {
    await userBookRoom(null, bookForm('room-g', [{ start: '08:30', end: '10:30' }]))

    const second = await userBookRoom(null, bookForm('room-g', [{ start: '08:30', end: '10:30' }]))

    // ข้อความเป็นของ exclusion constraint ตัวใดตัวหนึ่ง (ห้อง/ผู้ใช้) — แล้วแต่ DB ตรวจก่อน
    expect(second).toMatchObject({ ok: false })
    expect(reservations()).toHaveLength(1)
  })
})
