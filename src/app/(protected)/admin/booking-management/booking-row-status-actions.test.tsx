import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('./cancel-override-actions', () => ({
  cancelReservationAction: vi.fn(),
  overrideReservationStatusAction: vi.fn(),
}))

import type { AdminBookingRow } from '@/lib/admin/booking-admin'
import { buttonLabels } from '@/lib/admin/test-fixtures'
import { RESERVATION_STATUSES } from '@/lib/booking/reservation-status'

import BookingRowStatusActions from './booking-row-status-actions'

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

describe('BookingRowStatusActions', () => {
  it('ทุกสถานะมีปุ่มแก้ไขสถานะและยกเลิกการจอง (ยกเลิก/override ได้เสมอ)', () => {
    for (const status of RESERVATION_STATUSES) {
      const html = renderToStaticMarkup(<BookingRowStatusActions row={row({ status })} />)

      expect(buttonLabels(html), status).toEqual(['แก้ไขสถานะ', 'ยกเลิกการจอง'])
    }
  })

  it('สถานะ NO_SHOW ก็ยังมีปุ่มแก้ไขสถานะ (แก้กลับเป็น ACTIVE ได้)', () => {
    const html = renderToStaticMarkup(<BookingRowStatusActions row={row({ status: 'NO_SHOW' })} />)

    expect(buttonLabels(html)).toContain('แก้ไขสถานะ')
  })
})
