import { beforeEach, describe, expect, it, vi } from 'vitest'

const { processMock } = vi.hoisted(() => ({
  processMock: vi.fn(async () => ({ sent: 1, retried: 0, failed: 0 })),
}))

vi.mock('@/lib/notifications/outbox', () => ({ processOutboxBatch: processMock }))

import { GET, POST } from './route'

const SECRET = 'cron-secret-test'

function request(headers: Record<string, string> = {}, method = 'GET') {
  return new Request('https://booking.example/api/cron/outbox', { method, headers })
}

describe('/api/cron/outbox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', SECRET)
  })

  it('ยิงด้วย Bearer CRON_SECRET ที่ถูกต้อง → ประมวลผลคิวและคืนสรุปผล', async () => {
    const response = await GET(request({ authorization: `Bearer ${SECRET}` }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ sent: 1, retried: 0, failed: 0 })
    expect(processMock).toHaveBeenCalledTimes(1)
  })

  it('รองรับ x-cron-secret สำหรับตัวจัดตารางที่ไม่ตั้ง Authorization header', async () => {
    const response = await GET(request({ 'x-cron-secret': SECRET }))

    expect(response.status).toBe(200)
    expect(processMock).toHaveBeenCalledTimes(1)
  })

  it('POST ก็ทำงานได้ (บางตัวจัดตารางยิง POST)', async () => {
    const response = await POST(request({ authorization: `Bearer ${SECRET}` }, 'POST'))

    expect(response.status).toBe(200)
    expect(processMock).toHaveBeenCalledTimes(1)
  })

  it('secret ไม่ถูกต้อง → 401 และไม่แตะคิว', async () => {
    const response = await GET(request({ authorization: 'Bearer wrong' }))

    expect(response.status).toBe(401)
    expect(processMock).not.toHaveBeenCalled()
  })

  it('ไม่มี secret มาด้วย → 401', async () => {
    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(processMock).not.toHaveBeenCalled()
  })

  it('ยังไม่ได้ตั้ง CRON_SECRET ฝั่งเซิร์ฟเวอร์ → 500 (fail closed) ไม่แตะคิว', async () => {
    vi.stubEnv('CRON_SECRET', '')

    const response = await GET(request({ authorization: 'Bearer anything' }))

    expect(response.status).toBe(500)
    expect(processMock).not.toHaveBeenCalled()
  })
})
