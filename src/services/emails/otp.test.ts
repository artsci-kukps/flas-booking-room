import { describe, expect, it } from 'vitest'

import { renderOtpEmail } from './otp'

describe('renderOtpEmail', () => {
  it('ใส่รหัสและอายุรหัสไว้ในหัวเรื่อง', () => {
    const mail = renderOtpEmail({ code: '123456' })

    expect(mail.subject).toContain('ยืนยันการสมัครสมาชิก Creative Space')
    expect(mail.subject).toContain('10 นาที')
  })

  it('แสดงรหัสตัวใหญ่ในกรอบสีเขียวแบรนด์ และไม่มีปุ่ม CTA', () => {
    const mail = renderOtpEmail({ code: '123456' })

    expect(mail.html).toContain('123456')
    expect(mail.html).toContain('#0e7a4b')
    expect(mail.html).toContain('#e9f4ee')
    expect(mail.html).toContain('Creative Space')
    // flat design: ไม่มีปุ่มให้กด และไม่มีเงา
    expect(mail.html).not.toContain('<button')
    expect(mail.html).not.toContain('box-shadow')
  })

  it('มีข้อความล้วนคู่กันเสมอสำหรับไคลเอนต์ที่ไม่แสดง HTML', () => {
    const mail = renderOtpEmail({ code: '123456' })

    expect(mail.text).toContain('123456')
    expect(mail.text).toContain('10 นาที')
    expect(mail.text).not.toContain('<')
  })

  it('escape รหัสก่อนแทรกใน HTML', () => {
    const mail = renderOtpEmail({ code: '<b>1</b>' })

    expect(mail.html).not.toContain('<b>1</b>')
    expect(mail.html).toContain('&lt;b&gt;')
  })

  it('รับอายุรหัสที่กำหนดเองได้', () => {
    const mail = renderOtpEmail({ code: '123456', expiresInMinutes: 5 })

    expect(mail.subject).toContain('5 นาที')
    expect(mail.text).toContain('5 นาที')
  })
})
