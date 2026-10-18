import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { getDayAvailabilityMock } = vi.hoisted(() => ({
  getDayAvailabilityMock: vi.fn(),
}))

vi.mock('@/lib/booking/day-availability', () => ({
  getDayAvailability: getDayAvailabilityMock,
}))

// ตัวเลือกช่องเป็น client component ที่มีเทสต์ของตัวเองใน slot-picker.test.tsx
// — ที่นี่ตรวจเฉพาะการดึงข้อมูลและการส่งต่อของแผง
vi.mock('./slot-picker', () => ({
  default: ({ date, rooms }: { date: string; rooms: { id: string; name: string }[] }) => (
    <section
      data-testid="slot-picker"
      data-date={date}
      data-rooms={rooms.map((room) => room.name).join(',')}
    />
  ),
}))

import type { DayAvailability, RoomSlotView } from '@/lib/booking/day-availability'

import AvailabilityPanel from './availability-panel'

function makeSlot(overrides: Partial<RoomSlotView> = {}): RoomSlotView {
  return {
    start: '08:30',
    end: '09:30',
    status: 'free',
    usedCount: 0,
    past: false,
    selectable: true,
    ...overrides,
  }
}

/** วันทำการเปิด: ห้อง CAPACITY 1 ห้อง + ห้อง EXCLUSIVE 1 ห้อง */
const OPEN_DAY: DayAvailability = {
  date: '2026-10-19',
  open: true,
  kind: 'NORMAL',
  openTime: '08:30',
  closeTime: '16:30',
  slots: [
    { start: '08:30', end: '09:30' },
    { start: '09:30', end: '10:30' },
    { start: '10:30', end: '11:30' },
    { start: '11:30', end: '12:30' },
  ],
  rooms: [
    {
      id: 'room-s',
      name: 'S-101',
      roomTypeCode: 'S',
      roomTypeName: 'ห้องทั่วไป',
      bookingMode: 'CAPACITY',
      maxCapacity: 4,
      slots: [
        makeSlot(),
        makeSlot({ start: '09:30', end: '10:30', status: 'occupied', usedCount: 2 }),
        makeSlot({ start: '10:30', end: '11:30', status: 'blocked', selectable: false }),
        makeSlot({ start: '11:30', end: '12:30', past: true, selectable: false }),
      ],
    },
    {
      id: 'room-g',
      name: 'G-101',
      roomTypeCode: 'G',
      roomTypeName: 'ห้องประชุมใหญ่',
      bookingMode: 'EXCLUSIVE',
      maxCapacity: null,
      slots: [
        makeSlot({ status: 'occupied', usedCount: 1, selectable: false }),
        makeSlot({ start: '09:30', end: '10:30' }),
      ],
    },
  ],
}

describe('availability panel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDayAvailabilityMock.mockResolvedValue(OPEN_DAY)
  })

  it('วันเปิด: แสดงวันที่ไทย เวลาทำการ และส่งวันที่ + ห้องทั้งหมดให้ตัวเลือกช่อง', async () => {
    const html = renderToStaticMarkup(await AvailabilityPanel({ date: '2026-10-19' }))

    expect(getDayAvailabilityMock).toHaveBeenCalledWith('2026-10-19')
    expect(html).toContain('2569') // ปีพุทธศักราชจาก formatThaiDate
    expect(html).toContain('08:30–16:30')
    expect(html).toContain('data-date="2026-10-19"')
    expect(html).toContain('data-rooms="S-101,G-101"')
  })

  it('วันเสาร์–อาทิตย์: แสดงข้อความปิดทำการ ไม่แสดงห้อง', async () => {
    getDayAvailabilityMock.mockResolvedValue({
      date: '2026-10-17',
      open: false,
      reason: 'weekend',
      holidayName: null,
    } satisfies DayAvailability)

    const html = renderToStaticMarkup(await AvailabilityPanel({ date: '2026-10-17' }))

    expect(html).toContain('ปิดทำการ')
    expect(html).toContain('เสาร์')
    expect(html).not.toContain('data-testid="slot-picker"')
  })

  it('วันหยุด: แสดงชื่อวันหยุดกำกับ', async () => {
    getDayAvailabilityMock.mockResolvedValue({
      date: '2026-10-19',
      open: false,
      reason: 'holiday',
      holidayName: 'วันปิยมหาราช',
    } satisfies DayAvailability)

    const html = renderToStaticMarkup(await AvailabilityPanel({ date: '2026-10-19' }))

    expect(html).toContain('วันปิยมหาราช')
    expect(html).toContain('ปิดทำการ')
  })

  it('ยังไม่มีช่วงเวลาให้บริการ: แจ้งให้ผู้ใช้ทราบ', async () => {
    getDayAvailabilityMock.mockResolvedValue({
      date: '2026-10-19',
      open: false,
      reason: 'no-service-period',
      holidayName: null,
    } satisfies DayAvailability)

    const html = renderToStaticMarkup(await AvailabilityPanel({ date: '2026-10-19' }))

    expect(html).toContain('ยังไม่มีช่วงเวลาให้บริการ')
  })
})
