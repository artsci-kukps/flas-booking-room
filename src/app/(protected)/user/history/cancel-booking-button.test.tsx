import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('./actions', () => ({ cancelBooking: vi.fn() }))

import { buttonLabels } from '@/lib/admin/test-fixtures'

import CancelBookingButton from './cancel-booking-button'

describe('CancelBookingButton', () => {
  it('แสดงปุ่มยกเลิกการจองในสถานะเริ่มต้น (ยังไม่ยืนยัน)', () => {
    const html = renderToStaticMarkup(<CancelBookingButton bookingId="res-1" />)

    expect(buttonLabels(html)).toContain('ยกเลิกการจอง')
  })

  it('ยังไม่ส่ง id ใด ๆ ก่อนผู้ใช้กดยืนยัน', () => {
    const html = renderToStaticMarkup(<CancelBookingButton bookingId="res-1" />)

    expect(html).not.toContain('name="id"')
  })
})
