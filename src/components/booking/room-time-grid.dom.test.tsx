import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { BookRoomAction } from '@/lib/booking/booking-action'
import type { DayAvailability, RoomSlotView } from '@/lib/booking/day-availability'

import RoomTimeGrid from './room-time-grid'

/**
 * ทดสอบแบบ DOM ของตารางห้อง × เวลา (ticket #20)
 *
 * ไฟล์ทดสอบเดิมใช้ renderToStaticMarkup จึง "คลิกไม่ได้" — ไฟล์นี้เป็นแม่แบบ
 * สำหรับการทดสอบแบบโต้ตอบ (คลิกช่องว่าง → เปิด popup → ยืนยัน → ช่องอัปเดต)
 *
 * ข้อสำคัญ: ไฟล์ที่ลงท้ายด้วย `.dom.test.tsx` จะถูกโปรเจกต์ "dom" ของ vitest
 * รับด้วย environment: jsdom (ดู vitest.config.mts) — ไฟล์อื่นยังเป็น node เหมือนเดิม
 */

const bookRoomMock = vi.fn()

// popup ที่เปิดจากการคลิกช่องว่างเรียก useRouter() ของ Next ต้องมี App Router context
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

const TODAY = '2026-10-19'

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

function renderGrid() {
  return render(
    <RoomTimeGrid
      date={TODAY}
      today={TODAY}
      availability={openDay()}
      bookRoomAction={bookRoomMock as unknown as BookRoomAction}
    />,
  )
}

describe('RoomTimeGrid (DOM) — ตารางห้อง × เวลา', () => {
  it('ช่องว่างเป็นปุ่มที่กดได้ ส่วนช่องที่ไม่ว่างถูกปิดปุ่ม', () => {
    renderGrid()

    const table = within(screen.getByRole('table'))

    expect(table.getByRole('button', { name: '08:30–09:30 น. ว่าง' })).toBeEnabled()
    expect(table.getByRole('button', { name: /09:30–10:30 น\. ไม่ว่าง/ })).toBeDisabled()
  })

  it('คลิกช่องว่างแล้ว popup จองเปิดขึ้น (คลิกจริงได้ในสภาพแวดล้อม DOM)', () => {
    renderGrid()

    expect(screen.queryByRole('dialog')).toBeNull()

    const table = within(screen.getByRole('table'))
    fireEvent.click(table.getByRole('button', { name: '08:30–09:30 น. ว่าง' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
