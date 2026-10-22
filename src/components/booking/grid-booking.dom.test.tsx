import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { BookRoomAction } from '@/lib/booking/booking-action'
import type { DayAvailability, RoomSlotView } from '@/lib/booking/day-availability'
import { formatThaiDate } from '@/lib/format'

import RoomTimeGrid from './room-time-grid'

/**
 * ทดสอบแบบ DOM ของการจองจากตารางห้อง × เวลา (ticket #20, #22)
 *
 * ครอบคลุม flow จริงของผู้ใช้: คลิกช่องว่าง → popup เปิดพร้อมวันที่/เวลา/ห้องที่เลือกไว้ล่วงหน้า
 * → ยืนยันการจอง → ช่องที่เพิ่งจองเปลี่ยนเป็น "ไม่ว่าง" ทันทีโดยไม่ต้องออกจากหน้าตาราง
 *
 * สิ่งที่จำลอง: router.refresh() ของ Next ดึง server component ใหม่ → หน้าเปลี่ยน availability
 * ในเทสต์นี้ "server component ใหม่" คือ harness ที่เปลี่ยนสถานะช่องที่จองเป็น "ไม่ว่าง"
 */

const { refreshMock, refreshHook } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  /** จุดที่ harness ลงทะเบียน "พฤติกรรม server" หลัง router.refresh() */
  refreshHook: { current: null as null | (() => void) },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: () => {
      refreshMock()
      refreshHook.current?.()
    },
  }),
}))

const TODAY = '2026-10-19'
const BOOKED_SLOT = '08:30'

function makeSlot(start: string, end: string, overrides: Partial<RoomSlotView> = {}): RoomSlotView {
  return {
    start,
    end,
    status: 'free',
    usedCount: 0,
    past: false,
    selectable: true,
    ...overrides,
  }
}

/** วันเปิด 08:30–10:30 — ห้อง S-101 (CAPACITY 4, บล็อก 60) ช่องว่าง 1 ช่อง + ช่องเต็มความจุ 1 ช่อง */
function openDay(): Extract<DayAvailability, { open: true }> {
  return {
    date: TODAY,
    open: true,
    kind: 'NORMAL',
    openTime: '08:30',
    closeTime: '10:30',
    rooms: [
      {
        id: 'room-s',
        name: 'S-101',
        roomTypeCode: 'S',
        roomTypeName: 'ห้องทั่วไป',
        bookingMode: 'CAPACITY',
        maxCapacity: 4,
        minDurationMinutes: 60,
        slots: [
          makeSlot('08:30', '09:30'),
          makeSlot('09:30', '10:30', { status: 'occupied', usedCount: 4, selectable: false }),
        ],
      },
    ],
  }
}

/** จำลอง server ที่ส่ง availability ใหม่หลัง refresh — ช่องที่จองกลายเป็น "ไม่ว่าง" */
function markBooked(day: Extract<DayAvailability, { open: true }>): Extract<DayAvailability, { open: true }> {
  return {
    ...day,
    rooms: day.rooms.map((room) => ({
      ...room,
      slots: room.slots.map((slot) =>
        slot.start === BOOKED_SLOT
          ? { ...slot, status: 'occupied' as const, usedCount: 1, selectable: false }
          : slot,
      ),
    })),
  }
}

const bookRoomAction = vi.fn<BookRoomAction>()

/**
 * หน้าตารางจริงที่ถือ availability ไว้ใน state — เหมือน Next ที่ router.refresh()
 * แล้ว server component ส่ง props ใหม่กลับมา
 */
function GridHarness() {
  const [availability, setAvailability] = useState(openDay())

  useEffect(() => {
    refreshHook.current = () => setAvailability((current) => markBooked(current))
  }, [])

  return (
    <RoomTimeGrid
      date={TODAY}
      today={TODAY}
      availability={availability}
      bookRoomAction={bookRoomAction}
    />
  )
}

/** ปุ่มช่องเวลาในตาราง (ไม่นับชิปของการ์ดมือถือที่ซ้ำกัน) */
function tableSlot(name: RegExp | string) {
  return within(screen.getByRole('table')).getByRole('button', { name })
}

beforeEach(() => {
  vi.clearAllMocks()
  refreshHook.current = null
  bookRoomAction.mockImplementation(async () => ({ ok: true, bookingCodes: ['123456'] }))
})

describe('จองจากคลิกช่องว่างในตาราง (DOM) — ticket #20', () => {
  it('คลิกช่องว่าง → popup เปิดพร้อมวันที่ เวลา ห้อง ที่เลือกไว้ล่วงหน้า', async () => {
    render(<GridHarness />)

    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(tableSlot('08:30–09:30 น. ว่าง'))

    const dialog = await screen.findByRole('dialog')

    // ห้องและวันที่ที่คลิกมาแสดงในหัว popup
    expect(dialog).toHaveTextContent('S-101')
    expect(dialog).toHaveTextContent('ห้องทั่วไป')
    expect(dialog).toHaveTextContent(formatThaiDate(TODAY))

    // ช่องที่คลิกถูกเลือกไว้แล้ว (aria-pressed) และปุ่มยืนยันพร้อมใช้งาน
    const picked = within(dialog).getByRole('button', { name: '08:30–09:30 น. ว่าง' })

    expect(picked).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).getByRole('button', { name: 'ยืนยันการจอง' })).toBeEnabled()
  })

  it('ปุ่มยืนยันส่งวันที่ ห้อง และบล็อกที่เลือกไว้ล่วงหน้าให้ server action', async () => {
    render(<GridHarness />)

    fireEvent.click(tableSlot('08:30–09:30 น. ว่าง'))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'ยืนยันการจอง' }))

    await waitFor(() => {
      expect(bookRoomAction).toHaveBeenCalledTimes(1)
    })

    const formData = bookRoomAction.mock.calls[0]![1] as FormData

    expect(formData.get('date')).toBe(TODAY)
    expect(formData.get('roomId')).toBe('room-s')
    expect(JSON.parse(String(formData.get('blocks')))).toEqual([
      { start: '08:30', end: '09:30' },
    ])
  })
})

describe('อัปเดตตารางหลังจองจาก popup (DOM) — ticket #22', () => {
  it('จองสำเร็จ → ช่องที่จองเปลี่ยนเป็น "ไม่ว่าง" ทันที โดยไม่ต้องออกจากหน้าตาราง', async () => {
    render(<GridHarness />)

    fireEvent.click(tableSlot('08:30–09:30 น. ว่าง'))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'ยืนยันการจอง' }))

    // หน้าถูกรีเฟรชหลังจองจบ → ตารางดึงข้อมูลล่าสุด
    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalledTimes(1)
    })

    // ช่องที่เพิ่งจองกลายเป็น "ไม่ว่าง" และเลือกซ้ำไม่ได้
    await waitFor(() => {
      expect(tableSlot(/08:30–09:30 น\. ไม่ว่าง/)).toBeDisabled()
    })
  })

  it('จองสำเร็จ → popup แสดงรหัสการจองและยืนยันว่าส่งอีเมลแล้ว (ไม่พาออกจากหน้าตาราง)', async () => {
    render(<GridHarness />)

    fireEvent.click(tableSlot('08:30–09:30 น. ว่าง'))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'ยืนยันการจอง' }))

    await waitFor(() => {
      expect(dialog).toHaveTextContent('จองสำเร็จ')
    })

    expect(dialog).toHaveTextContent('123456')
    expect(dialog).toHaveTextContent('ส่งอีเมลแจ้งเตือน')
    // ปุ่มยืนยันถูกปิด กันจองซ้ำบล็อกเดิมใน popup เดิม
    expect(within(dialog).getByRole('button', { name: 'จองแล้ว' })).toBeDisabled()
  })

  it('จองไม่สำเร็จ → popup แสดงข้อความ และตารางถูกรีเฟรช (ช่องที่คนอื่นจองไปต้องไม่ค้างเป็น "ว่าง")', async () => {
    bookRoomAction.mockResolvedValue({
      ok: false,
      message: 'ช่วงเวลานี้มีผู้ใช้จองห้องนี้แล้ว กรุณาเลือกช่วงเวลาอื่น',
    })

    render(<GridHarness />)

    fireEvent.click(tableSlot('08:30–09:30 น. ว่าง'))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'ยืนยันการจอง' }))

    await waitFor(() => {
      expect(dialog).toHaveTextContent('จองไม่สำเร็จ')
    })

    expect(dialog).toHaveTextContent('ช่วงเวลานี้มีผู้ใช้จองห้องนี้แล้ว')
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })
})
