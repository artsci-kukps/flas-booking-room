import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('./key-actions', () => ({
  confirmKeyPickupAction: vi.fn(),
  confirmKeyReturnAction: vi.fn(),
}))

import { buttonLabels } from '@/lib/admin/test-fixtures'
import type { AdminBookingRow } from '@/lib/admin/booking-admin'

import BookingRowActions from './booking-row-actions'

function row(overrides: Partial<AdminBookingRow> = {}): AdminBookingRow {
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

describe('BookingRowActions', () => {
  it('PENDING แสดงปุ่มยืนยันรับกุญแจ', () => {
    const html = renderToStaticMarkup(<BookingRowActions row={row()} />)

    expect(buttonLabels(html)).toEqual(['ยืนยันรับกุญแจ'])
  })

  it('ACTIVE แสดงปุ่มยืนยันคืนกุญแจ', () => {
    const html = renderToStaticMarkup(<BookingRowActions row={row({ status: 'ACTIVE' })} />)

    expect(buttonLabels(html)).toEqual(['ยืนยันคืนกุญแจ'])
  })

  it('สถานะที่วงจรกุญแจจบแล้วไม่มีปุ่มยืนยัน', () => {
    for (const status of ['COMPLETED', 'LATE_RETURN', 'CANCELLED', 'NO_SHOW'] as const) {
      const html = renderToStaticMarkup(<BookingRowActions row={row({ status })} />)

      expect(buttonLabels(html)).toEqual([])
    }
  })
})
