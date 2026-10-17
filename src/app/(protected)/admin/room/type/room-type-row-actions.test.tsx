import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('./actions', () => ({
  deleteRoomType: vi.fn(),
  restoreRoomType: vi.fn(),
}))

import { buttonLabels, makeRoomType } from '@/lib/admin/test-fixtures'

import RoomTypeRowActions from './room-type-row-actions'

const ROW = makeRoomType({ id: 'rt-s', code: 'S', typeName: 'ห้องทั่วไป' })

describe('RoomTypeRowActions', () => {
  it('แสดงปุ่มแก้ไขและลบ', () => {
    const html = renderToStaticMarkup(<RoomTypeRowActions row={ROW} onEdit={() => {}} />)

    expect(buttonLabels(html)).toEqual(['แก้ไข', 'ลบ'])
  })

  it('ส่ง id ของแถวไปกับฟอร์มลบ', () => {
    const html = renderToStaticMarkup(<RoomTypeRowActions row={ROW} onEdit={() => {}} />)

    expect(html).toContain('name="id" value="rt-s"')
  })
})
