import { describe, expect, it } from 'vitest'

import { renderBookingCodeEmail } from './booking-code'

const INPUT = {
  bookingCode: '123456',
  roomName: 'S-101',
  bookingDate: '2026-10-19',
  startTime: new Date('2026-10-19T02:30:00Z'), // 09:30 Bangkok
  endTime: new Date('2026-10-19T03:30:00Z'), // 10:30 Bangkok
}

describe('renderBookingCodeEmail', () => {
  it('ใส่รหัสการจองไว้ในหัวเรื่อง', () => {
    const mail = renderBookingCodeEmail(INPUT)

    expect(mail.subject).toContain('รหัสการจอง')
    expect(mail.subject).toContain('123456')
  })

  it('แสดงรหัสตัวใหญ่ กรอบสีเขียวแบรนด์ พร้อมห้องและช่วงเวลาแบบไทย', () => {
    const mail = renderBookingCodeEmail(INPUT)

    expect(mail.html).toContain('123456')
    expect(mail.html).toContain('#0e7a4b')
    expect(mail.html).toContain('#e9f4ee')
    expect(mail.html).toContain('S-101')
    expect(mail.html).toContain('19 ต.ค. 2569')
    expect(mail.html).toContain('09:30')
    expect(mail.html).toContain('10:30')
    // flat design: ไม่มีปุ่มให้กด และไม่มีเงา
    expect(mail.html).not.toContain('<button')
    expect(mail.html).not.toContain('box-shadow')
  })

  it('ย้ำให้เก็บรหัสไว้แสดงกับเจ้าหน้าที่ และบอกว่ารหัสอยู่ในหน้ายืนยันด้วย', () => {
    const mail = renderBookingCodeEmail(INPUT)

    expect(mail.html).toContain('รหัสการจอง')
    expect(mail.text).toContain('หน้ายืนยัน')
  })

  it('มีข้อความล้วนคู่กันเสมอสำหรับไคลเอนต์ที่ไม่แสดง HTML', () => {
    const mail = renderBookingCodeEmail(INPUT)

    expect(mail.text).toContain('123456')
    expect(mail.text).toContain('S-101')
    expect(mail.text).toContain('09:30')
    expect(mail.text).not.toContain('<')
  })

  it('escape ข้อมูลจาก payload ก่อนแทรกใน HTML', () => {
    const mail = renderBookingCodeEmail({ ...INPUT, roomName: '<b>S-101</b>' })

    expect(mail.html).not.toContain('<b>S-101</b>')
    expect(mail.html).toContain('&lt;b&gt;S-101&lt;/b&gt;')
  })
})
