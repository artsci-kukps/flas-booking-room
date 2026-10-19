import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { listRoomsMock } = vi.hoisted(() => ({ listRoomsMock: vi.fn() }))

vi.mock('@/lib/admin/rooms', () => ({ listRooms: listRoomsMock }))

// client component ที่ใช้ useRouter — เทสต์นี้ไม่ต้องนำทางจริง
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

// แผงช่องว่างดึง db จริง — แทนด้วยป้ายที่บันทึก props ไว้ตรวจการส่งต่อ
vi.mock('./availability-panel', () => ({
  default: ({
    date,
    roomId,
  }: {
    date: string
    roomId?: string
    bookRoomAction: unknown
  }) => <section data-testid="availability-panel" data-date={date} data-room={roomId ?? ''} />,
}))

import type { BookRoomAction } from '@/lib/booking/booking-action'

import BookingFlow from './booking-flow'

const bookRoomActionMock = vi.fn() as unknown as BookRoomAction

const ROOMS = [
  { id: 'room-s', name: 'S-101', roomTypeCode: 'S', roomTypeName: 'ห้องทั่วไป' },
  { id: 'room-g', name: 'G-101', roomTypeCode: 'G', roomTypeName: 'ห้องประชุมใหญ่' },
]

async function renderFlow(
  props: Partial<Parameters<typeof BookingFlow>[0]> = {},
) {
  return renderToStaticMarkup(
    await BookingFlow({
      basePath: '/user/booking',
      today: '2026-10-19',
      bookRoomAction: bookRoomActionMock,
      ...props,
    }),
  )
}

describe('booking flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listRoomsMock.mockResolvedValue(ROOMS)
  })

  it('ยังไม่เลือกห้อง: แสดงป้ายห้องและ popup เลือกวันนี้/วันพรุ่งนี้เท่านั้น', async () => {
    const html = await renderFlow()

    expect(listRoomsMock).toHaveBeenCalledTimes(1)
    expect(html).toContain('data-room-id="room-s"')
    expect(html).toContain('วันนี้')
    expect(html).toContain('วันพรุ่งนี้')
    expect(html).not.toContain('2026-10-21')
    expect(html).not.toContain('data-testid="availability-panel"')
  })

  it('เลือกห้อง + วันที่ถูกต้อง: เข้าสู่ขั้นเลือกเวลา พร้อมแท็บวันของห้องนั้น', async () => {
    const html = await renderFlow({ date: '2026-10-20', roomId: 'room-g' })

    expect(html).toContain('data-testid="availability-panel"')
    expect(html).toContain('data-date="2026-10-20"')
    expect(html).toContain('data-room="room-g"')
    // แท็บวันคงห้องไว้ทั้งสองวัน และไม่เกินวันพรุ่งนี้
    expect(html).toContain('/user/booking?date=2026-10-19&amp;room=room-g')
    expect(html).toContain('/user/booking?date=2026-10-20&amp;room=room-g')
    expect(html).not.toContain('2026-10-21')
  })

  it('วันที่เกินกว่าวันพรุ่งนี้: ไม่เข้าขั้นเลือกเวลา กลับไปเลือกวันใหม่', async () => {
    const html = await renderFlow({ date: '2026-10-21', roomId: 'room-g' })

    expect(html).not.toContain('data-testid="availability-panel"')
    expect(html).toContain('data-room-id="room-g"')
  })

  it('วันที่ก่อนวันนี้ก็ไม่อยู่ในหน้าต่างที่จองได้', async () => {
    const html = await renderFlow({ date: '2026-10-18', roomId: 'room-g' })

    expect(html).not.toContain('data-testid="availability-panel"')
  })

  it('ห้องที่ไม่รู้จัก: ไม่เข้าขั้นเลือกเวลา', async () => {
    const html = await renderFlow({ date: '2026-10-20', roomId: 'room-x' })

    expect(html).not.toContain('data-testid="availability-panel"')
  })

  it('มีห้องแต่ไม่มีวันที่: เริ่มจาก popup เลือกวัน', async () => {
    const html = await renderFlow({ roomId: 'room-g' })

    expect(html).not.toContain('data-testid="availability-panel"')
    expect(html).toContain('เลือกวันที่จอง')
  })
})
