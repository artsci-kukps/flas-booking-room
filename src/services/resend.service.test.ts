import { describe, expect, it, vi } from 'vitest'

import { createResendSender } from './resend.service'

const MESSAGE = {
  to: 'booker@ku.th',
  subject: 'รหัสการจอง Creative Space: 123456',
  html: '<p>123456</p>',
  text: '123456',
}

function okResponse() {
  return { ok: true, status: 200, text: async () => '{"id":"re_1"}' } as unknown as Response
}

describe('createResendSender', () => {
  it('POST ไปที่ Resend API ด้วย Bearer key และ body ครบถ้วน', async () => {
    const fetchImpl = vi.fn(async () => okResponse())
    const send = createResendSender({
      apiKey: 're_test_key',
      from: 'Creative Space <booking@ku.th>',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    await send(MESSAGE)

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test_key')
    expect(JSON.parse(init.body as string)).toEqual({
      from: 'Creative Space <booking@ku.th>',
      to: ['booker@ku.th'],
      subject: MESSAGE.subject,
      html: MESSAGE.html,
      text: MESSAGE.text,
    })
  })

  it('โยน error พร้อมสถานะและข้อความจาก Resend เมื่อส่งไม่สำเร็จ', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 422,
      text: async () => 'invalid `to` field',
    })) as unknown as typeof fetch
    const send = createResendSender({ apiKey: 'k', from: 'a@b.c', fetchImpl })

    await expect(send(MESSAGE)).rejects.toThrow('422')
    await expect(send(MESSAGE)).rejects.toThrow('invalid `to` field')
  })

  it('โยน error ก่อนยิง fetch เมื่อยังไม่ได้ตั้งค่า API key', async () => {
    const fetchImpl = vi.fn()
    const send = createResendSender({
      apiKey: '',
      from: 'a@b.c',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    await expect(send(MESSAGE)).rejects.toThrow('RESEND_API_KEY')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
