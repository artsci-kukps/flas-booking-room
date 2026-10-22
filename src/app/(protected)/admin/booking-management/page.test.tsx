import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { requireAdminMock, listBookingsForDayMock, findBookingByCodeOnDayMock, getDayAvailabilityMock, bookRoomMock, bookRoomFromTableMock, gridProps } =
  vi.hoisted(() => ({
    requireAdminMock: vi.fn(),
    listBookingsForDayMock: vi.fn(),
    findBookingByCodeOnDayMock: vi.fn(),
    getDayAvailabilityMock: vi.fn(),
    bookRoomMock: vi.fn(),
    bookRoomFromTableMock: vi.fn(),
    gridProps: { bookRoomAction: undefined as unknown },
  }))

vi.mock('@/lib/auth/guards', () => ({ requireAdmin: requireAdminMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/admin/booking-admin', () => ({
  listBookingsForDay: listBookingsForDayMock,
  findBookingByCodeOnDay: findBookingByCodeOnDayMock,
  isBookingCode: (value: string) => /^\d{6}$/.test(value),
}))
// ตารางสถานะห้องดึงความพร้อมของวัน — คงตรรกะวันที่ (parseBookingDate) ไว้ แล้ว stub การดึง DB
vi.mock('@/lib/booking/day-availability', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/booking/day-availability')>()),
  getDayAvailability: getDayAvailabilityMock,
}))
// server action จองของแอดมิน — ส่งเข้า client component เป็น prop เทสต์นี้ไม่เรียกจริง
vi.mock('@/app/(protected)/admin/booking/actions', () => ({
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

import { ADMIN, buttonLabels } from '@/lib/admin/test-fixtures'
import type { AdminBookingRow } from '@/lib/admin/booking-admin'
import type { DayAvailability } from '@/lib/booking/day-availability'

import BookingManagementPage from './page'

const DATE = '2026-10-19'

function bookingRow(overrides: Partial<AdminBookingRow> = {}): AdminBookingRow {
  return {
    id: 'r-1',
    bookingCode: '123456',
    bookerName: 'สมชาย ใจดี',
    bookerEmail: 'somchai@ku.th',
    roomName: 'S-101',
    roomTypeCode: 'S',
    startTime: new Date('2026-10-19T02:30:00Z'),
    endTime: new Date('2026-10-19T03:30:00Z'),
    status: 'PENDING',
    ...overrides,
  }
}

function render(params: Record<string, string> = {}): Promise<string> {
  return BookingManagementPage({
    searchParams: Promise.resolve({ date: DATE, ...params }),
  }).then(renderToStaticMarkup)
}

/** วันเปิดพร้อมห้อง S-204 สองช่วง (ว่าง + ถูกบล็อก) — ใช้ตรวจตารางสถานะบนหน้า */
function openDay(): DayAvailability {
  return {
    date: DATE,
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
            status: 'blocked',
            usedCount: 0,
            past: false,
            selectable: false,
          },
        ],
      },
    ],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  requireAdminMock.mockResolvedValue(ADMIN)
  listBookingsForDayMock.mockResolvedValue([bookingRow()])
  findBookingByCodeOnDayMock.mockResolvedValue(null)
  getDayAvailabilityMock.mockResolvedValue(openDay())
})

describe('admin booking-management page', () => {
  it('ตรวจสิทธิ์แอดมินก่อนแสดงผล', async () => {
    await render()

    expect(requireAdminMock).toHaveBeenCalledTimes(1)
  })

  it('แสดงตารางการจองตามวันและห้อง พร้อมผู้จอง ช่วงเวลา และสถานะ', async () => {
    const html = await render()

    expect(html).toContain('123456')
    expect(html).toContain('สมชาย ใจดี')
    expect(html).toContain('somchai@ku.th')
    expect(html).toContain('S-101')
    expect(html).toContain('รอรับกุญแจ')
  })

  it('มีปุ่มยืนยันรับกุญแจสำหรับรายการ PENDING', async () => {
    const labels = buttonLabels(await render())

    expect(labels).toContain('ยืนยันรับกุญแจ')
  })

  it('มีปุ่มยืนยันคืนกุญแจสำหรับรายการ ACTIVE', async () => {
    listBookingsForDayMock.mockResolvedValue([bookingRow({ status: 'ACTIVE' })])

    const labels = buttonLabels(await render())

    expect(labels).toContain('ยืนยันคืนกุญแจ')
  })

  it('แจ้งเมื่อวันนั้นไม่มีการจอง', async () => {
    listBookingsForDayMock.mockResolvedValue([])

    const html = await render()

    expect(html).toContain('ไม่มีการจองในวันนี้')
  })

  it('ค้นรหัสที่มีจริงของวันนี้ → แสดงผลการค้นพร้อมปุ่มรับ–คืนกุญแจ', async () => {
    findBookingByCodeOnDayMock.mockResolvedValue(bookingRow())

    const html = await render({ code: '123456' })

    expect(html).toContain('123456')
    expect(buttonLabels(html)).toContain('ยืนยันรับกุญแจ')
  })

  it('ค้นรหัสที่ไม่พบในวันนี้ → แจ้งว่าไม่พบ (จำกัดขอบเขตวันนี้)', async () => {
    findBookingByCodeOnDayMock.mockResolvedValue(null)

    const html = await render({ code: '999999' })

    expect(html).toContain('ไม่พบรหัส 999999 ในวันนี้')
  })

  it('ค้นรหัสที่รูปแบบผิด → แจ้งข้อกำหนด 6 หลัก โดยไม่ค้นฐานข้อมูล', async () => {
    const html = await render({ code: 'abc' })

    expect(html).toContain('รหัสการจองต้องเป็นตัวเลข 6 หลัก')
    expect(findBookingByCodeOnDayMock).not.toHaveBeenCalled()
  })

  it('ค้นด้วยขอบเขตวันนี้เสมอ ไม่ใช่วันที่กำลังดูตาราง', async () => {
    findBookingByCodeOnDayMock.mockResolvedValue(null)
    // วันนี้ในเขตไทย — แหล่งความจริงอิสระจากตัวโค้ด
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' })
    const browsedDay = '2020-01-01' // วันของตารางคนละวันกับวันนี้

    await render({ date: browsedDay, code: '123456' })

    expect(findBookingByCodeOnDayMock).toHaveBeenCalledWith('123456', today)
  })

  it('แสดงตารางสถานะห้องของวันที่เลือก (ว่าง/ถูกบล็อก) จาก getDayAvailability', async () => {
    const html = await render()

    expect(getDayAvailabilityMock).toHaveBeenCalledWith(DATE)
    expect(html).toContain('ตารางสถานะห้อง')
    expect(html).toContain('S-204')
    expect(html).toContain('ว่าง')
    expect(html).toContain('ถูกบล็อก')
  })

  it('ตารางสถานะอยู่ร่วมหน้ากับตารางรายการจองเดิม — รับ–คืนกุญแจและลิงก์วันยังครบ', async () => {
    const html = await render()

    expect(html).toContain('ตารางสถานะห้อง')
    expect(html).toContain('รายการจองวันที่')
    expect(html).toContain('123456')
    expect(buttonLabels(html)).toContain('ยืนยันรับกุญแจ')
    expect(html).toContain('ดูวันก่อนหน้า')
  })

  it('ใช้ส่วนตารางสถานะห้องชุดเดียวกับทุกหน้า (หัวข้อ + คำอธิบาย + ตาราง)', async () => {
    const html = await render()

    expect(html).toContain('ตารางสถานะห้องวันที่')
    expect(html).toContain('สถานะช่วงเวลาของทุกห้องในวันเดียว')
  })

  it('ส่ง action ที่จองแล้วอยู่ในตาราง (ไม่พาไปหน้ายืนยัน) ให้ตาราง', async () => {
    await render()

    // ตารางต้องจองแบบไม่ redirect เพื่อให้ช่องที่จองเปลี่ยนเป็น "ไม่ว่าง" ทันที (ticket #22)
    expect(gridProps.bookRoomAction).toBe(bookRoomFromTableMock)
    expect(gridProps.bookRoomAction).not.toBe(bookRoomMock)
  })
})
