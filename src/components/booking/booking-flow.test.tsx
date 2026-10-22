import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { listRoomsMock, getDayAvailabilityMock } = vi.hoisted(() => ({
  listRoomsMock: vi.fn(),
  getDayAvailabilityMock: vi.fn(),
}))

vi.mock('@/lib/admin/rooms', () => ({ listRooms: listRoomsMock }))

// ความพร้อมของวันดึงจาก data layer เดิม — เทสต์นี้ป้อนค่าเพื่อตรวจการส่งต่อเข้า popup
vi.mock('@/lib/booking/day-availability', () => ({
  getDayAvailability: getDayAvailabilityMock,
}))

import type { BookRoomAction } from '@/lib/booking/booking-action'
import type { DayAvailability, RoomSlotView } from '@/lib/booking/day-availability'

import BookingFlow from './booking-flow'

const bookRoomActionMock = vi.fn() as unknown as BookRoomAction

const ROOMS = [
  {
    id: 'room-s',
    name: 'S-101',
    roomTypeCode: 'S',
    roomTypeName: 'ห้องทั่วไป',
    minDurationMinutes: 60,
  },
  {
    id: 'room-g',
    name: 'G-101',
    roomTypeCode: 'G',
    roomTypeName: 'ห้องประชุมใหญ่',
    minDurationMinutes: 120,
  },
]

function makeSlot(start: string, end: string): RoomSlotView {
  return {
    start,
    end,
    status: 'free',
    usedCount: 0,
    past: false,
    selectable: true,
  }
}

/** ช่องว่างต่างกันตามวัน — พิสูจน์ได้ว่า popup ใช้ช่องของวันที่เลือกจริง */
function openDay(date: string): DayAvailability {
  const isTomorrow = date === '2026-10-20'
  return {
    date,
    open: true,
    kind: 'NORMAL',
    openTime: '08:30',
    closeTime: '16:30',
    rooms: [
      {
        ...ROOMS[0]!,
        bookingMode: 'CAPACITY',
        maxCapacity: 4,
        slots: [isTomorrow ? makeSlot('10:30', '11:30') : makeSlot('08:30', '09:30')],
      },
      {
        ...ROOMS[1]!,
        bookingMode: 'EXCLUSIVE',
        maxCapacity: null,
        slots: [isTomorrow ? makeSlot('10:30', '12:30') : makeSlot('08:30', '10:30')],
      },
    ],
  }
}

async function renderFlow(
  props: Partial<Parameters<typeof BookingFlow>[0]> = {},
) {
  return renderToStaticMarkup(
    await BookingFlow({
      today: '2026-10-19',
      bookRoomAction: bookRoomActionMock,
      ...props,
    }),
  )
}

describe('booking flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listRoomsMock.mockResolvedValue(ROOMS)
    getDayAvailabilityMock.mockImplementation(async (date: string) => openDay(date))
  })

  it('ยังไม่เลือกห้อง: แสดงผนังป้ายห้อง + popup เลือกวันนี้/วันพรุ่งนี้ พร้อมดึงความพร้อมของทั้งสองวัน', async () => {
    const html = await renderFlow()

    expect(listRoomsMock).toHaveBeenCalledTimes(1)
    // ดึงความพร้อมของทุกวันที่จองได้ (วันนี้ + วันพรุ่งนี้) จาก data layer เดิม
    expect(getDayAvailabilityMock).toHaveBeenCalledTimes(2)
    expect(getDayAvailabilityMock).toHaveBeenCalledWith('2026-10-19')
    expect(getDayAvailabilityMock).toHaveBeenCalledWith('2026-10-20')

    expect(html).toContain('data-room-id="room-s"')
    expect(html).toContain('วันนี้')
    expect(html).toContain('วันพรุ่งนี้')
    expect(html).not.toContain('2026-10-21')
    // ยังไม่ได้เลือกห้อง → ไม่มีช่องว่าง/ปุ่มยืนยันใน popup
    expect(html).not.toContain('ยืนยันการจอง')
    expect(html).not.toContain('08:30')
  })

  it('ลิงก์ ?room&date= ที่ถูกต้อง: popup เปิดพร้อมช่องว่างของวันนั้นและปุ่มยืนยัน', async () => {
    const html = await renderFlow({ date: '2026-10-20', roomId: 'room-g' })

    // ช่องของ "วันที่เลือก" (2026-10-20) ของห้อง G บล็อก 2 ชั่วโมง — ไม่ใช่ช่องของวันนี้
    expect(html).toContain('10:30–12:30')
    expect(html).not.toContain('08:30–10:30')
    expect(html).toContain('บล็อกละ 2 ชั่วโมง')
    expect(html).toContain('ยืนยันการจอง')
    expect(html).toContain('วันที่ 20 ต.ค. 2569')
  })

  it('วันที่เกินกว่าวันพรุ่งนี้: ไม่เปิดช่องว่าง กลับไปที่ผนังห้อง', async () => {
    const html = await renderFlow({ date: '2026-10-21', roomId: 'room-g' })

    expect(html).not.toContain('ยืนยันการจอง')
    expect(html).toContain('data-room-id="room-g"')
  })

  it('วันที่ก่อนวันนี้ก็ไม่อยู่ในหน้าต่างที่จองได้', async () => {
    const html = await renderFlow({ date: '2026-10-18', roomId: 'room-g' })

    expect(html).not.toContain('ยืนยันการจอง')
  })

  it('ห้องที่ไม่รู้จัก: ไม่เปิดช่องว่าง', async () => {
    const html = await renderFlow({ date: '2026-10-20', roomId: 'room-x' })

    expect(html).not.toContain('ยืนยันการจอง')
  })

  it('มีห้องแต่ไม่มีวันที่: เริ่มจาก popup เลือกวัน', async () => {
    const html = await renderFlow({ roomId: 'room-g' })

    expect(html).not.toContain('ยืนยันการจอง')
    expect(html).toContain('เลือกวันที่จอง')
  })
})
