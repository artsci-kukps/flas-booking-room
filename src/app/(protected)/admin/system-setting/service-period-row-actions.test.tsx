import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('./actions', () => ({
  deleteServicePeriod: vi.fn(),
}))

import { buttonLabels, makeServicePeriod } from '@/lib/admin/test-fixtures'

import ServicePeriodRowActions from './service-period-row-actions'

const ROW = makeServicePeriod({ id: 'sp-1' })

describe('ServicePeriodRowActions', () => {
  it('แสดงปุ่มแก้ไขและลบ', () => {
    const html = renderToStaticMarkup(<ServicePeriodRowActions row={ROW} onEdit={() => {}} />)

    expect(buttonLabels(html)).toEqual(['แก้ไข', 'ลบ'])
  })
})
