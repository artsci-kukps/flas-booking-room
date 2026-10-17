import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('./actions', () => ({
  deleteRoom: vi.fn(),
  restoreRoom: vi.fn(),
}))

import { buttonLabels, makeRoom } from '@/lib/admin/test-fixtures'

import RoomRowActions from './room-row-actions'

const ROW = makeRoom({ id: 'r1', name: 'S-101' })

describe('RoomRowActions', () => {
  it('แสดงปุ่มแก้ไขและลบ', () => {
    const html = renderToStaticMarkup(<RoomRowActions row={ROW} onEdit={() => {}} />)

    expect(buttonLabels(html)).toEqual(['แก้ไข', 'ลบ'])
  })

  it('ส่ง id ของแถวไปกับฟอร์มลบ', () => {
    const html = renderToStaticMarkup(<RoomRowActions row={ROW} onEdit={() => {}} />)

    expect(html).toContain('name="id" value="r1"')
  })
})
