import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { requireUserMock, getDayAvailabilityMock, bookRoomMock, bookRoomFromTableMock, gridProps } =
  vi.hoisted(() => ({
    requireUserMock: vi.fn(),
    getDayAvailabilityMock: vi.fn(),
    bookRoomMock: vi.fn(),
    bookRoomFromTableMock: vi.fn(),
    gridProps: { bookRoomAction: undefined as unknown },
  }))

vi.mock('@/lib/auth/guards', () => ({ requireUser: requireUserMock }))
// ตารางดึงความพร้อมของวัน — stub การดึง DB คงตรรกะวันที่/เวลาทำการไว้
vi.mock('@/lib/booking/day-availability', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/booking/day-availability')>()),
  getDayAvailability: getDayAvailabilityMock,
}))
// server action จองของผู้ใช้ — ส่งเป็น props เทสต์นี้ไม่เรียกจริง
vi.mock('@/app/(protected)/user/booking/actions', () => ({
  bookRoom: bookRoomMock,
  bookRoomFromTable: bookRoomFromTableMock,
}))
// บันทึก action ที่หน้าส่งให้ตาราง (แล้วยังวาดตารางจริงเหมือนเดิม)
vi.mock('@/components/booking/room-time-grid', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/booking/room-time-grid')>()
  const { createElement } = await import('react')

  return {
    default: (props: Parameters<typeof actual.default>[0]) => {
      gridProps.bookRoomAction = props.bookRoomAction

      return createElement(actual.default, props)
    },
  }
})
// ล็อกวันนี้ให้คงที่เพื่อให้หน้าต่างจอง (วันนี้/วันพรุ่งนี้) ตรวจได้คงที่
vi.mock('@/lib/admin/service-periods', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/admin/service-periods')>()),
  todayInBangkok: () => '2026-10-19',
}))

import type { DayAvailability } from '@/lib/booking/day-availability'

import UserTablePage from './page'

const TODAY = '2026-10-19'

function openDay(date: string): DayAvailability {
  return {
    date,
    open: true,
    kind: 'NORMAL',
    openTime: '08:30',
    closeTime: '10:30',
    rooms: [
      {
        id: 'room-s204',
        name: 'S-204',
        roomTypeCode: 'S',
        roomTypeName: 'ห้องทั่วไป',
        bookingMode: 'CAPACITY',
        maxCapacity: 4,
        minDurationMinutes: 60,
        slots: [
          {
            start: '08:30',
            end: '09:30',
            status: 'free',
            usedCount: 0,
            past: false,
            selectable: true,
          },
          {
            start: '09:30',
            end: '10:30',
            status: 'occupied',
            usedCount: 4,
            past: false,
            selectable: false,
          },
        ],
      },
    ],
  }
}

function renderPage(params: Record<string, string | string[] | undefined> = {}) {
  return UserTablePage({ searchParams: Promise.resolve(params) }).then(renderToStaticMarkup)
}

describe('หน้าตารางจองของผู้ใช้ (/user/table)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireUserMock.mockResolvedValue({
      id: 'u1',
      email: 'somchai@ku.th',
      fullName: 'สมชาย ใจดี',
      imageUrl: null,
      role: 'user',
      isBlocked: false,
    })
    getDayAvailabilityMock.mockImplementation(async (date: string) => openDay(date))
  })

  it('ตรวจสิทธิ์ผู้ใช้ก่อนแสดงตาราง', async () => {
    await renderPage()

    expect(requireUserMock).toHaveBeenCalledTimes(1)
  })

  it('แสดงตารางสถานะทุกช่วงเวลาของทุกห้อง (ว่าง/ไม่ว่าง) ของวันนี้', async () => {
    const html = await renderPage()

    expect(getDayAvailabilityMock).toHaveBeenCalledWith(TODAY)
    expect(html).toContain('ตารางจอง')
    expect(html).toContain('S-204')
    expect(html).toContain('ว่าง')
    expect(html).toContain('ไม่ว่าง 4/4')
    expect(html).toContain('สัญลักษณ์สถานะ')
  })

  it('วันนี้อยู่ในหน้าต่างจอง → มีคำใบ้คลิกช่องว่างเพื่อจองผ่าน popup', async () => {
    const html = await renderPage()

    expect(html).toContain('คลิกช่องว่างในตารางเพื่อเปิด popup จอง')
  })

  it('ใช้ส่วนตารางสถานะห้องชุดเดียวกับทุกหน้า (หัวข้อ + คำอธิบาย + ตาราง)', async () => {
    const html = await renderPage()

    expect(html).toContain('ตารางสถานะห้องวันที่')
    expect(html).toContain('สถานะช่วงเวลาของทุกห้องในวันเดียว')
  })

  it('?date= เลือกวันของตารางได้ (และเป็นวันนอกหน้าต่างจอง → ดูอย่างเดียว)', async () => {
    const html = await renderPage({ date: '2026-10-21' })

    expect(getDayAvailabilityMock).toHaveBeenCalledWith('2026-10-21')
    expect(html).toContain('หน้าต่างการจองคือวันนี้และวันพรุ่งนี้')
    expect(html).not.toContain('คลิกช่องว่างในตารางเพื่อเปิด popup จอง')
  })

  it('มีตัวเลือกวันที่เฉพาะวันนี้และวันพรุ่งนี้ของหน้าตารางของผู้ใช้เอง', async () => {
    const html = await renderPage()

    expect(html).toContain('/user/table?date=2026-10-19')
    expect(html).toContain('/user/table?date=2026-10-20')
    expect(html).toContain('วันนี้')
    expect(html).toContain('พรุ่งนี้')
    expect(html).not.toContain('/user/table?date=2026-10-18')
    expect(html).not.toContain('/user/table?date=2026-10-21')
  })

  it('ส่ง action ที่จองแล้วอยู่ในตาราง (ไม่พาไปหน้ายืนยัน) ให้ตาราง', async () => {
    await renderPage()

    // ตารางต้องจองแบบไม่ redirect เพื่อให้ช่องที่จองเปลี่ยนเป็น "ไม่ว่าง" ทันที (ticket #22)
    expect(gridProps.bookRoomAction).toBe(bookRoomFromTableMock)
    expect(gridProps.bookRoomAction).not.toBe(bookRoomMock)
  })
})
