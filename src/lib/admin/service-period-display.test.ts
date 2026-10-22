import { describe, expect, it } from 'vitest'

import { makeServicePeriod } from './test-fixtures'

import {
  formatEffectiveRange,
  formatServiceTimeRange,
  isEffectiveOn,
  SERVICE_PERIOD_KIND_LABEL,
} from './service-period-display'

describe('SERVICE_PERIOD_KIND_LABEL', () => {
  it('มีป้ายกำกับครบทั้ง NORMAL และ EXAM', () => {
    expect(SERVICE_PERIOD_KIND_LABEL.NORMAL).toBe('วันปกติ')
    expect(SERVICE_PERIOD_KIND_LABEL.EXAM).toBe('ช่วงสอบ')
  })
})

describe('formatServiceTimeRange', () => {
  it('แสดงช่วงเวลาเป็น 08:30–16:30', () => {
    const row = makeServicePeriod({ id: 'sp-1' })

    expect(formatServiceTimeRange(row)).toBe('08:30–16:30')
  })

  it('ตัดวินาทีทิ้งเมื่อ PG คืน HH:MM:SS', () => {
    const row = makeServicePeriod({ id: 'sp-1', openTime: '08:30:00', closeTime: '16:30:00' })

    expect(formatServiceTimeRange(row)).toBe('08:30–16:30')
  })
})

describe('formatEffectiveRange', () => {
  it('แสดงเป็นวันที่ไทยเมื่อกำหนดวันสิ้นสุด', () => {
    const row = makeServicePeriod({ id: 'sp-1', effectiveFrom: '2026-05-01', effectiveTo: '2026-05-31' })

    expect(formatEffectiveRange(row)).toContain('พ.ค.')
    expect(formatEffectiveRange(row)).toContain('–')
  })

  it('แสดงว่าไม่กำหนดสิ้นสุดเมื่อ effective_to ว่าง', () => {
    const row = makeServicePeriod({ id: 'sp-1', effectiveTo: null })

    expect(formatEffectiveRange(row)).toContain('ไม่กำหนดสิ้นสุด')
  })
})

describe('isEffectiveOn', () => {
  it('จริงเมื่อวันนั้นอยู่ในช่วงมีผล (รวมขอบเขต)', () => {
    const row = makeServicePeriod({ id: 'sp-1', effectiveFrom: '2026-05-01', effectiveTo: '2026-05-31' })

    expect(isEffectiveOn(row, '2026-05-01')).toBe(true)
    expect(isEffectiveOn(row, '2026-05-31')).toBe(true)
    expect(isEffectiveOn(row, '2026-06-01')).toBe(false)
    expect(isEffectiveOn(row, '2026-04-30')).toBe(false)
  })

  it('จริงตลอดเมื่อไม่กำหนดวันสิ้นสุด', () => {
    const row = makeServicePeriod({ id: 'sp-1', effectiveFrom: '2026-05-01' })

    expect(isEffectiveOn(row, '2099-12-31')).toBe(true)
  })
})
