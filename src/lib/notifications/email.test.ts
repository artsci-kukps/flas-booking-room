import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * เทสต์อีเมลแจ้งเตือน (รหัสการจอง/ยกเลิก) — ส่งทันทีผ่าน SMTP
 * mock เฉพาะชั้น transport (`@/services/email.service`) เพื่อตรวจ "เนื้ออีเมล"
 * ที่ประกอบจริงจากเทมเพลต โดยไม่ยิงเครือข่าย
 */

const { sendEmailMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn<(message: unknown) => Promise<void>>(async () => {}),
}))

vi.mock('@/services/email.service', () => ({
  sendEmail: sendEmailMock,
}))

import { sendAllBestEffort, sendBookingCancellationEmail, sendBookingCodeEmail } from './email'

const BASE = {
  toEmail: 'booker@ku.th',
  bookingCode: '123456',
  roomName: 'S-101',
  bookingDate: '2026-10-19',
  startTime: new Date('2026-10-19T02:30:00Z'),
  endTime: new Date('2026-10-19T03:30:00Z'),
}

beforeEach(() => {
  vi.clearAllMocks()
  sendEmailMock.mockImplementation(async () => {})
})

describe('sendBookingCodeEmail', () => {
  it('ส่งอีเมลรหัสการจองหนึ่งฉบับ พร้อมหัวเรื่องและเนื้อหาไทย', async () => {
    await sendBookingCodeEmail(BASE)

    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    const message = sendEmailMock.mock.calls[0]![0] as {
      to: string
      subject: string
      html: string
      text: string
    }

    expect(message.to).toBe('booker@ku.th')
    expect(message.subject).toBe('รหัสการจอง Creative Space: 123456')
    expect(message.html).toContain('123456')
    expect(message.html).toContain('S-101')
    expect(message.text).toContain('123456')
    expect(message.text).toContain('S-101')
    expect(message.text).toContain('09:30–10:30 น.')
  })

  it('ส่งไม่สำเร็จ → โยน error ออกไปให้ผู้เรียกจัดการ (best-effort อยู่ที่ผู้เรียก)', async () => {
    sendEmailMock.mockRejectedValueOnce(new Error('smtp down'))

    await expect(sendBookingCodeEmail(BASE)).rejects.toThrow('smtp down')
  })
})

describe('sendBookingCancellationEmail', () => {
  it('ส่งอีเมลยกเลิกพร้อมเหตุผลเมื่อมี reason', async () => {
    await sendBookingCancellationEmail({ ...BASE, reason: 'ห้องถูกใช้จัดงานสำคัญ' })

    const message = sendEmailMock.mock.calls[0]![0] as {
      subject: string
      html: string
      text: string
    }

    expect(message.subject).toBe('ยกเลิกการจอง Creative Space: 123456')
    expect(message.html).toContain('ห้องถูกใช้จัดงานสำคัญ')
    expect(message.text).toContain('เหตุผลการยกเลิก: ห้องถูกใช้จัดงานสำคัญ')
  })

  it('reason เป็น null (ผู้ใช้ยกเลิกเอง) → ไม่มีบล็อกเหตุผล', async () => {
    await sendBookingCancellationEmail({ ...BASE, reason: null })

    const message = sendEmailMock.mock.calls[0]![0] as { text: string }

    expect(message.text).not.toContain('เหตุผลการยกเลิก')
  })
})

describe('sendAllBestEffort', () => {
  it('ส่งครบทุกฉบับ และ log เฉพาะฉบับที่ล้มเหลว', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const send = vi
      .fn<(message: number) => Promise<void>>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('smtp down'))

    await sendAllBestEffort([1, 2], send, 'ส่งอีเมลไม่สำเร็จ')

    expect(send).toHaveBeenCalledTimes(2)
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith('ส่งอีเมลไม่สำเร็จ', expect.any(Error))

    errorSpy.mockRestore()
  })

  it('ไม่มีรายการ → ไม่เรียก sender และไม่ log', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const send = vi.fn<(message: number) => Promise<void>>(async () => {})

    await sendAllBestEffort([], send, 'ส่งอีเมลไม่สำเร็จ')

    expect(send).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()

    errorSpy.mockRestore()
  })
})
