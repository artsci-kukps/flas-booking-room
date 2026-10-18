import { beforeEach, describe, expect, it, vi } from 'vitest'

import { servicePeriod } from '@/db/schema'

/**
 * จำลอง query ของ drizzle ที่ "await ได้" และ "ต่อ .orderBy() ได้"
 * เพื่อให้ทั้ง select แบบเดี่ยวและแบบมี orderBy ใช้ selectWhereMock ตัวเดียวกัน
 */
function rowsQuery(rows: unknown[]) {
  return {
    orderBy: vi.fn(async () => rows),
    then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  }
}

const {
  selectMock,
  selectWhereMock,
  selectOrderByMock,
  insertMock,
  insertValuesMock,
  updateMock,
  updateSetMock,
  updateWhereMock,
  deleteMock,
  deleteWhereMock,
  executeMock,
  transactionMock,
} = vi.hoisted(() => {
  const selectWhereMock = vi.fn()
  const selectOrderByMock = vi.fn(async () => [])
  const fromMock = vi.fn(() => ({ where: selectWhereMock, orderBy: selectOrderByMock }))
  const selectMock = vi.fn(() => ({ from: fromMock }))

  const insertValuesMock = vi.fn(async () => undefined)
  const insertMock = vi.fn(() => ({ values: insertValuesMock }))

  const updateWhereMock = vi.fn(async () => undefined)
  const updateSetMock = vi.fn(() => ({ where: updateWhereMock }))
  const updateMock = vi.fn(() => ({ set: updateSetMock }))

  const deleteWhereMock = vi.fn(async () => ({ rowCount: 1 }))
  const deleteMock = vi.fn(() => ({ where: deleteWhereMock }))

  const executeMock = vi.fn(async () => undefined)
  const transactionMock = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      select: selectMock,
      insert: insertMock,
      update: updateMock,
      delete: deleteMock,
      execute: executeMock,
    }),
  )

  return {
    selectMock,
    fromMock,
    selectWhereMock,
    selectOrderByMock,
    insertMock,
    insertValuesMock,
    updateMock,
    updateSetMock,
    updateWhereMock,
    deleteMock,
    deleteWhereMock,
    executeMock,
    transactionMock,
  }
})

vi.mock('@/db', () => ({
  default: {
    select: selectMock,
    insert: insertMock,
    update: updateMock,
    delete: deleteMock,
    transaction: transactionMock,
  },
}))

import {
  createServicePeriod,
  deleteServicePeriod,
  ensureDefaultServicePeriod,
  isServicePeriodKind,
  listServicePeriods,
  resolveServicePeriodForDate,
  updateServicePeriod,
  validateServicePeriodInput,
  type ServicePeriodInput,
  type ServicePeriodRow,
} from './service-periods'

function input(overrides: Partial<ServicePeriodInput> = {}): ServicePeriodInput {
  return {
    name: 'ช่วงปกติ',
    kind: 'NORMAL',
    openTime: '08:30',
    closeTime: '16:30',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    ...overrides,
  }
}

function row(overrides: Partial<ServicePeriodRow> = {}): ServicePeriodRow {
  return {
    id: 'sp-1',
    name: 'ช่วงปกติ',
    kind: 'NORMAL',
    openTime: '08:30',
    closeTime: '16:30',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

/** ข้อผิดพลาด exclusion violation (23P01) แบบที่ drizzle ห่อไว้ */
function exclusionViolation() {
  return Object.assign(new Error('conflicting key value violates exclusion constraint'), {
    cause: { code: '23P01' },
  })
}

/** ข้อผิดพลาด check violation (23514) */
function checkViolation() {
  return Object.assign(new Error('new row for relation violates check constraint'), {
    cause: { code: '23514' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  selectWhereMock.mockReset()
  selectOrderByMock.mockReset().mockResolvedValue([])
  insertValuesMock.mockReset().mockResolvedValue(undefined)
  updateWhereMock.mockReset().mockResolvedValue(undefined)
  deleteWhereMock.mockReset().mockResolvedValue({ rowCount: 1 })
  executeMock.mockReset().mockResolvedValue(undefined)
})

describe('isServicePeriodKind', () => {
  it('ยอมรับเฉพาะ NORMAL และ EXAM', () => {
    expect(isServicePeriodKind('NORMAL')).toBe(true)
    expect(isServicePeriodKind('EXAM')).toBe(true)
    expect(isServicePeriodKind('holiday')).toBe(false)
    expect(isServicePeriodKind(null)).toBe(false)
  })
})

describe('validateServicePeriodInput', () => {
  it('ปล่อยผ่านอินพุตที่ถูกต้อง', () => {
    expect(validateServicePeriodInput(input())).toBeNull()
  })

  it(' effective_to ว่าง (null) = มีผลต่อเนื่อง ปล่อยผ่าน', () => {
    expect(validateServicePeriodInput(input({ effectiveTo: null }))).toBeNull()
  })

  it('ปิดต้องมากกว่าเปิด', () => {
    expect(validateServicePeriodInput(input({ openTime: '16:30', closeTime: '16:30' })))
      .toBeTypeOf('string')
    expect(validateServicePeriodInput(input({ openTime: '17:00', closeTime: '08:30' })))
      .toBeTypeOf('string')
  })

  it('effective_to ต้องไม่ก่อน effective_from', () => {
    expect(
      validateServicePeriodInput(input({ effectiveFrom: '2026-02-01', effectiveTo: '2026-01-31' })),
    ).toBeTypeOf('string')
  })

  it('effective_to เท่ากับ effective_from ได้ (วันเดียว)', () => {
    expect(
      validateServicePeriodInput(input({ effectiveFrom: '2026-02-01', effectiveTo: '2026-02-01' })),
    ).toBeNull()
  })

  it('kind ต้องเป็น NORMAL หรือ EXAM', () => {
    expect(validateServicePeriodInput(input({ kind: 'HOLIDAY' as never }))).toBeTypeOf('string')
  })

  it('ชื่อห้ามว่างและยาวเกิน 100 ตัวอักษร', () => {
    expect(validateServicePeriodInput(input({ name: '   ' }))).toBeTypeOf('string')
    expect(validateServicePeriodInput(input({ name: 'ก'.repeat(101) }))).toBeTypeOf('string')
  })

  it('เวลาต้องอยู่รูปแบบ HH:MM', () => {
    expect(validateServicePeriodInput(input({ openTime: '8:30' }))).toBeTypeOf('string')
    expect(validateServicePeriodInput(input({ closeTime: '16:30:00' }))).toBeNull()
    expect(validateServicePeriodInput(input({ closeTime: 'ab:cd' }))).toBeTypeOf('string')
  })

  it('วันที่ต้องอยู่รูปแบบ YYYY-MM-DD', () => {
    expect(validateServicePeriodInput(input({ effectiveFrom: '01/01/2026' }))).toBeTypeOf('string')
  })
})

describe('resolveServicePeriodForDate', () => {
  it('คืน null เมื่อไม่มีช่วงที่มีผลในวันนั้น', () => {
    expect(resolveServicePeriodForDate([], '2026-06-01')).toBeNull()
  })

  it('คืนช่วง NORMAL ที่ครอบวันนั้น (effective_to ว่าง = ต่อเนื่อง)', () => {
    const normal = row()

    expect(resolveServicePeriodForDate([normal], '2026-06-01')).toBe(normal)
  })

  it('ไม่คืนช่วงที่ยังไม่เริ่มหรือจบไปแล้ว', () => {
    const past = row({ effectiveFrom: '2026-01-01', effectiveTo: '2026-01-31' })

    expect(resolveServicePeriodForDate([past], '2026-06-01')).toBeNull()
  })

  it('เมื่อมี EXAM ทับ NORMAL ในวันเดียวกัน ใช้ EXAM', () => {
    const normal = row()
    const exam = row({ id: 'sp-2', kind: 'EXAM', effectiveFrom: '2026-05-01', effectiveTo: '2026-07-31' })

    expect(resolveServicePeriodForDate([normal, exam], '2026-06-01')).toBe(exam)
  })

  it('เมื่อมีหลายช่วง EXAM ที่มีผล (_created ล่าสุดชนะ_) ใช้ช่วงที่สร้างล่าสุด', () => {
    const older = row({
      id: 'sp-2',
      kind: 'EXAM',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    })
    const newer = row({
      id: 'sp-3',
      kind: 'EXAM',
      name: 'ช่วงสอบปลายภาค',
      createdAt: new Date('2026-03-01T00:00:00Z'),
    })

    expect(resolveServicePeriodForDate([older, newer], '2026-06-01')).toBe(newer)
    // ไม่พึ่งลำดับในอาร์เรย์
    expect(resolveServicePeriodForDate([newer, older], '2026-06-01')).toBe(newer)
  })
})

describe('listServicePeriods', () => {
  it('คืนแถวล่าสุดก่อนตาม effective_from และ created_at', async () => {
    const rows = [row()]
    selectOrderByMock.mockImplementation(async () => rows)

    await expect(listServicePeriods()).resolves.toBe(rows)
    expect(selectOrderByMock).toHaveBeenCalledTimes(1)
  })
})

describe('createServicePeriod', () => {
  it('insert ค่าที่ trim แล้วพร้อม created_by', async () => {
    await expect(createServicePeriod(input({ name: ' ช่วงปกติ ' }), 'a1')).resolves.toEqual({
      ok: true,
    })

    expect(insertValuesMock).toHaveBeenCalledWith({
      name: 'ช่วงปกติ',
      kind: 'NORMAL',
      openTime: '08:30',
      closeTime: '16:30',
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      createdBy: 'a1',
    })
  })

  it('ปฏิเสธอินพุตที่ไม่ผ่านกฎโดเมนโดยไม่แตะฐานข้อมูล', async () => {
    const result = await createServicePeriod(input({ closeTime: '08:00' }), 'a1')

    expect(result).toMatchObject({ ok: false })
    expect(insertValuesMock).not.toHaveBeenCalled()
  })

  it('แปลง exclusion violation (ทับช่วงเดียวกัน) เป็นข้อความไทย', async () => {
    insertValuesMock.mockRejectedValueOnce(exclusionViolation())

    const result = await createServicePeriod(input(), 'a1')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('ทับซ้อน')
    }
  })

  it('แปลง check violation จาก DB เป็นข้อความไทย', async () => {
    insertValuesMock.mockRejectedValueOnce(checkViolation())

    const result = await createServicePeriod(input(), 'a1')

    expect(result.ok).toBe(false)
  })
})

describe('updateServicePeriod', () => {
  function mockExisting(overrides: Partial<ServicePeriodRow> = {}) {
    selectWhereMock.mockImplementation(() => rowsQuery([row(overrides)]))
  }

  it('อัปเดตค่าที่ trim แล้วเมื่อเจอแถว', async () => {
    mockExisting()

    await expect(updateServicePeriod('sp-1', input({ name: 'ใหม่' }))).resolves.toEqual({ ok: true })

    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ใหม่' }),
    )
    expect(updateWhereMock).toHaveBeenCalledTimes(1)
  })

  it('คืนข้อความไทยเมื่อไม่พบแถว', async () => {
    selectWhereMock.mockImplementation(() => rowsQuery([]))

    const result = await updateServicePeriod('sp-missing', input())

    expect(result.ok).toBe(false)
    expect(updateSetMock).not.toHaveBeenCalled()
  })

  it('แปลง exclusion violation ตอนแก้ไขทับช่วงเดิมเป็นข้อความไทย', async () => {
    mockExisting()
    updateWhereMock.mockRejectedValueOnce(exclusionViolation())

    const result = await updateServicePeriod('sp-1', input())

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('ทับซ้อน')
    }
  })
})

describe('deleteServicePeriod', () => {
  it('ลบจริง (hard delete) ตาม id', async () => {
    await expect(deleteServicePeriod('sp-1')).resolves.toEqual({ ok: true })

    expect(deleteWhereMock).toHaveBeenCalledTimes(1)
  })

  it('คืนข้อความไทยเมื่อไม่เจอแถวที่จะลบ', async () => {
    deleteWhereMock.mockResolvedValueOnce({ rowCount: 0 })

    const result = await deleteServicePeriod('sp-missing')

    expect(result.ok).toBe(false)
  })
})

describe('ensureDefaultServicePeriod', () => {
  function mockAdminAndExisting(adminId: string | null, existingRows: unknown[]) {
    // เรียก select 2 ครั้ง: หาแอดมินตามอีเมล แล้วตรวจว่ามี NORMAL อยู่หรือยัง
    selectWhereMock
      .mockImplementationOnce(() => rowsQuery(adminId ? [{ id: adminId }] : []))
      .mockImplementationOnce(() => rowsQuery(existingRows))
  }

  it('เพิ่ม NORMAL 08:30–16:30 ของวันนั้นเมื่อยังไม่มีช่วง NORMAL เลย', async () => {
    mockAdminAndExisting('a1', [])

    const outcome = await ensureDefaultServicePeriod('admin@ku.th', '2026-10-18')

    expect(outcome).toBe('created')
    expect(insertValuesMock).toHaveBeenCalledWith({
      name: 'เวลาทำการปกติ',
      kind: 'NORMAL',
      openTime: '08:30',
      closeTime: '16:30',
      effectiveFrom: '2026-10-18',
      effectiveTo: null,
      createdBy: 'a1',
    })
  })

  it('ข้ามเมื่อมีช่วง NORMAL อยู่แล้ว (เรียกซ้ำได้)', async () => {
    mockAdminAndExisting('a1', [row()])

    const outcome = await ensureDefaultServicePeriod('admin@ku.th', '2026-10-18')

    expect(outcome).toBe('skipped')
    expect(insertValuesMock).not.toHaveBeenCalled()
  })

  it('คืน no-admin เมื่อไม่พบผู้ใช้ (ยังไม่ได้ตั้งแอดมินคนแรก)', async () => {
    selectWhereMock.mockImplementationOnce(() => rowsQuery([]))

    const outcome = await ensureDefaultServicePeriod('nobody@ku.th', '2026-10-18')

    expect(outcome).toBe('no-admin')
    expect(insertValuesMock).not.toHaveBeenCalled()
  })
})

// กันหลงทาง: ตาราง service_period ที่ mock ไว้ต้องเป็นตารางจริงจาก schema
describe('schema sanity', () => {
  it('ใช้ตาราง service_period จริง', () => {
    expect(servicePeriod).toBeDefined()
  })
})
