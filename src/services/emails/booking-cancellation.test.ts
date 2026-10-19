import { describe, expect, it } from 'vitest'

import {
  bookingCancellationEmailSubject,
  renderBookingCancellationEmail,
} from './booking-cancellation'

const INPUT = {
  bookingCode: '123456',
  roomName: 'S-101',
  bookingDate: '2026-10-19',
  startTime: new Date('2026-10-19T02:30:00Z'), // 09:30 Bangkok
  endTime: new Date('2026-10-19T03:30:00Z'), // 10:30 Bangkok
}

describe('renderBookingCancellationEmail', () => {
  it('ใส่รหัสการจองไว้ในหัวเรื่อง และบอกว่าเป็นการยกเลิก', () => {
    const subject = bookingCancellationEmailSubject('123456')

    expect(subject).toContain('ยกเลิก')
    expect(subject).toContain('123456')
    expect(renderBookingCancellationEmail(INPUT).subject).toBe(subject)
  })

  it('แสดงรหัสการจอง ห้อง และวันเวลาไทย ใน HTML', () => {
    const mail = renderBookingCancellationEmail(INPUT)

    expect(mail.html).toContain('123456')
    expect(mail.html).toContain('S-101')
    expect(mail.html).toContain('19 ต.ค. 2569')
    expect(mail.html).toContain('09:30')
    expect(mail.html).toContain('10:30')
    expect(mail.html).toContain('ยกเลิก')
  })

  it('ไม่ต้องมีปุ่ม CTA และไม่มีเงา เหมือนเทมเพลตอื่น (flat design)', () => {
    const mail = renderBookingCancellationEmail(INPUT)

    expect(mail.html).not.toContain('<button')
    expect(mail.html).not.toContain('box-shadow')
  })

  it('มีข้อความล้วนคู่กันเสมอสำหรับไคลเอนต์ที่ไม่แสดง HTML', () => {
    const mail = renderBookingCancellationEmail(INPUT)

    expect(mail.text).toContain('123456')
    expect(mail.text).toContain('S-101')
    expect(mail.text).toContain('09:30')
    expect(mail.text).not.toContain('<')
  })

  it('แสดงเหตุผลการยกเลิกเมื่อมี และไม่แสดงหัวข้อเหตุผลเมื่อไม่มี', () => {
    const withReason = renderBookingCancellationEmail({ ...INPUT, reason: 'ผู้ใช้โทรขอยกเลิก' })
    const withoutReason = renderBookingCancellationEmail({ ...INPUT, reason: null })

    expect(withReason.html).toContain('ผู้ใช้โทรขอยกเลิก')
    expect(withReason.text).toContain('ผู้ใช้โทรขอยกเลิก')
    expect(withoutReason.html).not.toContain('เหตุผลการยกเลิก')
    expect(withoutReason.text).not.toContain('เหตุผลการยกเลิก')
  })

  it('ไม่แสดงหัวข้อเหตุผลเมื่อเหตุผลเป็นช่องว่างล้วน', () => {
    const mail = renderBookingCancellationEmail({ ...INPUT, reason: '   ' })

    expect(mail.html).not.toContain('เหตุผลการยกเลิก')
    expect(mail.text).not.toContain('เหตุผลการยกเลิก')
  })

  it('escape ข้อมูลจาก payload ก่อนแทรกใน HTML', () => {
    const mail = renderBookingCancellationEmail({
      ...INPUT,
      roomName: '<b>S-101</b>',
      reason: '<script>alert(1)</script>',
    })

    expect(mail.html).not.toContain('<b>S-101</b>')
    expect(mail.html).not.toContain('<script>alert(1)</script>')
    expect(mail.html).toContain('&lt;b&gt;S-101&lt;/b&gt;')
  })
})
