import type { AuthUser } from '@/lib/auth/guards'

import type { HolidayRow } from './holidays'
import type { RoomWithDeletedRow } from './rooms'
import type { RoomTypeWithDeletedRow } from './room-types'
import type { ServicePeriodRow } from './service-periods'

/**
 * ตัวช่วยร่วมของเทสต์หน้าจัดการห้องและประเภทห้อง
 * รวมไว้ที่เดียวเพื่อไม่ให้โครงข้อมูล (room/room-type) และตัวดึงป้ายปุ่มซ้ำกันหลายไฟล์
 */

/** แถวประเภทห้องตัวอย่าง — ค่าเริ่มต้นเป็นรายการที่ยังใช้งานอยู่ (deleted_at = null) */
export function makeRoomType(
  overrides: Partial<RoomTypeWithDeletedRow> & Pick<RoomTypeWithDeletedRow, 'id'>,
): RoomTypeWithDeletedRow {
  return {
    code: 'S',
    typeName: 'ห้องทั่วไป',
    bookingMode: 'CAPACITY',
    minDurationMinutes: 60,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  }
}

/** แถวห้องตัวอย่าง — ค่าเริ่มต้นเป็นห้อง S ที่ยังใช้งานอยู่ */
export function makeRoom(
  overrides: Partial<RoomWithDeletedRow> & Pick<RoomWithDeletedRow, 'id'>,
): RoomWithDeletedRow {
  return {
    name: 'S-101',
    roomTypeId: 'rt-s',
    roomTypeCode: 'S',
    roomTypeName: 'ห้องทั่วไป',
    bookingMode: 'CAPACITY',
    maxCapacity: 4,
    minDurationMinutes: 60,
    facilities: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  }
}

/** แถวช่วงเวลาให้บริการตัวอย่าง — ค่าเริ่มต้นเป็นช่วง NORMAL ปกติ */
export function makeServicePeriod(
  overrides: Partial<ServicePeriodRow> & Pick<ServicePeriodRow, 'id'>,
): ServicePeriodRow {
  return {
    name: 'เวลาทำการปกติ',
    kind: 'NORMAL',
    openTime: '08:30',
    closeTime: '16:30',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

/** แถววันหยุดตัวอย่าง — ค่าเริ่มต้นเป็นวันจักรี */
export function makeHoliday(
  overrides: Partial<HolidayRow> & Pick<HolidayRow, 'id'>,
): HolidayRow {
  return {
    holidayDate: '2026-04-06',
    name: 'วันจักรี',
    note: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

/** ค่าที่ requireAdmin() คืนในเทสต์ (แอดมินที่กำลังใช้งาน) */
export const ADMIN: AuthUser = {
  id: 'a1',
  email: 'admin@ku.th',
  fullName: 'ผู้ดูแล ระบบ',
  imageUrl: null,
  role: 'admin',
  isBlocked: false,
}

/** ดึงข้อความบนปุ่มทั้งหมดออกจาก HTML ที่เรนเดอร์ */
export function buttonLabels(html: string): string[] {
  return [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((match) =>
    match[1]!.replace(/<[^>]*>/g, '').trim(),
  )
}
