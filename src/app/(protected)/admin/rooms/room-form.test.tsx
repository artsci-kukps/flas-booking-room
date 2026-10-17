import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('./actions', () => ({
  createRoom: vi.fn(),
  updateRoom: vi.fn(),
}))

import { makeRoom, makeRoomType } from '@/lib/admin/test-fixtures'

import RoomForm from './room-form'

const CAPACITY_TYPE = makeRoomType({ id: 'rt-s', code: 'S', typeName: 'ห้องทั่วไป' })
const EXCLUSIVE_TYPE = makeRoomType({
  id: 'rt-g',
  code: 'G',
  typeName: 'ห้องประชุมใหญ่',
  bookingMode: 'EXCLUSIVE',
  minDurationMinutes: 30,
})

/** ดึงแท็ก <input name="maxCapacity" ...> ออกจาก HTML เพื่อตรวจ attribute required */
function capacityInput(html: string): string {
  return html.match(/<input[^>]*name="maxCapacity"[^>]*>/)?.[0] ?? ''
}

describe('RoomForm', () => {
  it('กำหนดความจำเป็นเมื่อประเภทที่เลือกเป็น CAPACITY', () => {
    const html = renderToStaticMarkup(
      <RoomForm
        mode="edit"
        row={makeRoom({ id: 'r1', roomTypeId: 'rt-s' })}
        roomTypes={[CAPACITY_TYPE]}
        onResult={() => {}}
        onCancel={() => {}}
      />,
    )

    expect(capacityInput(html)).toContain('required')
    expect(html).toContain('ต้องระบุความจุมากกว่า 0')
  })

  it('ไม่บังคับความจุเมื่อประเภทที่เลือกเป็น EXCLUSIVE', () => {
    const html = renderToStaticMarkup(
      <RoomForm
        mode="edit"
        row={makeRoom({
          id: 'r2',
          roomTypeId: 'rt-g',
          roomTypeCode: 'G',
          roomTypeName: 'ห้องประชุมใหญ่',
          bookingMode: 'EXCLUSIVE',
          maxCapacity: null,
        })}
        roomTypes={[EXCLUSIVE_TYPE]}
        onResult={() => {}}
        onCancel={() => {}}
      />,
    )

    expect(capacityInput(html)).not.toContain('required')
    expect(html).toContain('ไม่บังคับสำหรับประเภทที่ห้ามจองทับ')
  })

  it('เติมค่าเดิมของห้องในโหมดแก้ไข', () => {
    const html = renderToStaticMarkup(
      <RoomForm
        mode="edit"
        row={makeRoom({ id: 'r1', name: 'S-101', facilities: 'ไวท์บอร์ด', maxCapacity: 4 })}
        roomTypes={[CAPACITY_TYPE]}
        onResult={() => {}}
        onCancel={() => {}}
      />,
    )

    expect(html).toContain('value="S-101"')
    expect(html).toContain('value="4"')
    expect(html).toContain('ไวท์บอร์ด')
    expect(html).toContain('name="id" value="r1"')
  })

  it('เตือนและปิดปุ่มบันทึกเมื่อยังไม่มีประเภทห้องที่ใช้งานอยู่', () => {
    const html = renderToStaticMarkup(
      <RoomForm mode="create" roomTypes={[]} onResult={() => {}} />,
    )

    expect(html).toContain('ยังไม่มีประเภทห้องที่ใช้งานอยู่')
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled/)
  })
})
