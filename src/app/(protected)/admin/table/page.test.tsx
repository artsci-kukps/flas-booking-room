import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { requireAdminMock, getDayAvailabilityMock, bookRoomMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  getDayAvailabilityMock: vi.fn(),
  bookRoomMock: vi.fn(),
}))

vi.mock('@/lib/auth/guards', () => ({ requireAdmin: requireAdminMock }))
// ตารางดึงความพร้อมของวัน — stub การดึง DB คงตรรกะวันที่/เวลาทำการไว้
vi.mock('@/lib/booking/day-availability', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/booking/day-availability')>()),
  getDayAvailability: getDayAvailabilityMock,
}))
// server action จองของแอดมิน — ส่งเป็น props เทสต์นี้ไม่เรียกจริง
vi.mock('@/app/(protected)/admin/booking/actions', () => ({ bookRoom: bookRoomMock }))
// ล็อกวันนี้ให้คงที่เพื่อให้หน้าต่างจอง (วันนี้/วันพรุ่งนี้) ตรวจได้คงที่
vi.mock('@/lib/admin/service-periods', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/admin/service-periods')>()),
  todayInBangkok: () => '2026-10-19',
}))

import type { DayAvailability } from '@/lib/booking/day-availability'

import AdminTablePage from './page'

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
  return AdminTablePage({ searchParams: Promise.resolve(params) }).then(renderToStaticMarkup)
}

describe('หน้าตารางจองของแอดมิน (/admin/table)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminMock.mockResolvedValue({
      id: 'a1',
      email: 'admin@ku.th',
      fullName: 'แอดมิน',
      imageUrl: null,
      role: 'admin',
      isBlocked: false,
    })
    getDayAvailabilityMock.mockImplementation(async (date: string) => openDay(date))
  })

  it('ตรวจสิทธิ์แอดมินก่อนแสดงตาราง', async () => {
    await renderPage()

    expect(requireAdminMock).toHaveBeenCalledTimes(1)
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

  it('มีปุ่มจัดการการจองของแอดมิน', async () => {
    const html = await renderPage()

    expect(html).toContain('จัดการการจอง')
    expect(html).toContain('/admin/booking-management')
  })

  it('?date= เลือกวันของตารางได้ (และเป็นวันนอกหน้าต่างจอง → ดูอย่างเดียว)', async () => {
    const html = await renderPage({ date: '2026-10-21' })

    expect(getDayAvailabilityMock).toHaveBeenCalledWith('2026-10-21')
    expect(html).toContain('หน้าต่างการจองคือวันนี้และวันพรุ่งนี้')
    expect(html).not.toContain('คลิกช่องว่างในตารางเพื่อเปิด popup จอง')
  })

  it('มีตัวเลือกวันที่ชี้กลับมาหน้าตารางของแอดมินเอง', async () => {
    const html = await renderPage()

    expect(html).toContain('/admin/table?date=2026-10-18')
    expect(html).toContain('/admin/table?date=2026-10-20')
    expect(html).toContain('ดูวันก่อนหน้า')
  })
})
