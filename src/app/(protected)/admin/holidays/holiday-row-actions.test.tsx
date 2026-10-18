import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('./actions', () => ({
  deleteHoliday: vi.fn(),
}))

import { buttonLabels, makeHoliday } from '@/lib/admin/test-fixtures'

import HolidayRowActions from './holiday-row-actions'

const ROW = makeHoliday({ id: 'h-1' })

describe('HolidayRowActions', () => {
  it('แสดงปุ่มลบ', () => {
    const html = renderToStaticMarkup(<HolidayRowActions row={ROW} />)

    expect(buttonLabels(html)).toEqual(['ลบ'])
  })
})
