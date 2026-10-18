import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  selectMock,
  selectWhereMock,
  selectOrderByMock,
  insertMock,
  insertValuesMock,
  deleteMock,
  deleteWhereMock,
} = vi.hoisted(() => {
  const selectWhereMock = vi.fn()
  const selectOrderByMock = vi.fn(async (): Promise<unknown[]> => [])
  const fromMock = vi.fn(() => ({ where: selectWhereMock, orderBy: selectOrderByMock }))
  const selectMock = vi.fn(() => ({ from: fromMock }))

  const insertValuesMock = vi.fn(async () => undefined)
  const insertMock = vi.fn(() => ({ values: insertValuesMock }))

  const deleteWhereMock = vi.fn(async () => ({ rowCount: 1 }))
  const deleteMock = vi.fn(() => ({ where: deleteWhereMock }))

  return {
    selectMock,
    fromMock,
    selectWhereMock,
    selectOrderByMock,
    insertMock,
    insertValuesMock,
    deleteMock,
    deleteWhereMock,
  }
})

vi.mock('@/db', () => ({
  default: {
    select: selectMock,
    insert: insertMock,
    delete: deleteMock,
  },
}))

import {
  createHoliday,
  deleteHoliday,
  listHolidays,
  validateHolidayInput,
  type HolidayInput,
  type HolidayRow,
} from './holidays'

function input(overrides: Partial<HolidayInput> = {}): HolidayInput {
  return {
    holidayDate: '2026-04-06',
    name: 'วันจักรี',
    note: null,
    ...overrides,
  }
}

function row(overrides: Partial<HolidayRow> = {}): HolidayRow {
  return {
    id: 'h-1',
    holidayDate: '2026-04-06',
    name: 'วันจักรี',
    note: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

/** ข้อผิดพลาด unique violation (23505) — วันที่ซ้ำกับที่มีอยู่ */
function uniqueViolation() {
  return Object.assign(new Error('duplicate key value violates unique constraint'), {
    cause: { code: '23505' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  selectWhereMock.mockReset()
  selectOrderByMock.mockReset().mockResolvedValue([])
  insertValuesMock.mockReset().mockResolvedValue(undefined)
  deleteWhereMock.mockReset().mockResolvedValue({ rowCount: 1 })
})

describe('validateHolidayInput', () => {
  it('ปล่อยผ่านอินพุตที่ถูกต้อง', () => {
    expect(validateHolidayInput(input())).toBeNull()
  })

  it('วันที่ห้ามว่างและต้องอยู่รูปแบบ YYYY-MM-DD', () => {
    expect(validateHolidayInput(input({ holidayDate: '' }))).toBeTypeOf('string')
    expect(validateHolidayInput(input({ holidayDate: '06/04/2026' }))).toBeTypeOf('string')
  })

  it('ชื่อวันหยุดห้ามว่างและยาวเกิน 200 ตัวอักษร', () => {
    expect(validateHolidayInput(input({ name: '   ' }))).toBeTypeOf('string')
    expect(validateHolidayInput(input({ name: 'ก'.repeat(201) }))).toBeTypeOf('string')
  })

  it('หมายเหตุเป็นทางเลือก ไม่บังคับ', () => {
    expect(validateHolidayInput(input({ note: null }))).toBeNull()
    expect(validateHolidayInput(input({ note: 'ลากิจครึ่งวัน' }))).toBeNull()
  })
})

describe('listHolidays', () => {
  it('คืนรายการเรียงตามวันที่หยุด', async () => {
    const rows = [row()]
    selectOrderByMock.mockImplementation(async () => rows)

    await expect(listHolidays()).resolves.toBe(rows)
    expect(selectOrderByMock).toHaveBeenCalledTimes(1)
  })
})

describe('createHoliday', () => {
  it('insert ค่าที่ trim แล้วพร้อม created_by', async () => {
    await expect(createHoliday(input({ name: ' วันจักรี ' }), 'a1')).resolves.toEqual({ ok: true })

    expect(insertValuesMock).toHaveBeenCalledWith({
      holidayDate: '2026-04-06',
      name: 'วันจักรี',
      note: null,
      createdBy: 'a1',
    })
  })

  it('ปฏิเสธอินพุตที่ไม่ผ่านกฎโดเมนโดยไม่แตะฐานข้อมูล', async () => {
    const result = await createHoliday(input({ holidayDate: 'soon' }), 'a1')

    expect(result).toMatchObject({ ok: false })
    expect(insertValuesMock).not.toHaveBeenCalled()
  })

  it('แปลง unique violation (วันที่ซ้ำ) เป็นข้อความไทย', async () => {
    insertValuesMock.mockRejectedValueOnce(uniqueViolation())

    const result = await createHoliday(input(), 'a1')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('ซ้ำ')
    }
  })
})

describe('deleteHoliday', () => {
  it('ลบจริง (hard delete) ตาม id', async () => {
    await expect(deleteHoliday('h-1')).resolves.toEqual({ ok: true })

    expect(deleteWhereMock).toHaveBeenCalledTimes(1)
  })

  it('คืนข้อความไทยเมื่อไม่เจอแถวที่จะลบ', async () => {
    deleteWhereMock.mockResolvedValueOnce({ rowCount: 0 })

    const result = await deleteHoliday('h-missing')

    expect(result.ok).toBe(false)
  })
})
