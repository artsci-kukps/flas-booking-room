import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeRoomType } from './test-fixtures'

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
  insertMock,
  insertValuesMock,
  updateMock,
  updateSetMock,
  updateWhereMock,
  executeMock,
  transactionMock,
} = vi.hoisted(() => {
  const selectWhereMock = vi.fn()
  const fromMock = vi.fn(() => ({ where: selectWhereMock }))
  const selectMock = vi.fn(() => ({ from: fromMock }))

  const insertValuesMock = vi.fn(async () => undefined)
  const insertMock = vi.fn(() => ({ values: insertValuesMock }))

  const updateWhereMock = vi.fn(async () => undefined)
  const updateSetMock = vi.fn(() => ({ where: updateWhereMock }))
  const updateMock = vi.fn(() => ({ set: updateSetMock }))

  const executeMock = vi.fn(async () => undefined)
  const transactionMock = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({ select: selectMock, insert: insertMock, update: updateMock, execute: executeMock }),
  )

  return {
    selectMock,
    fromMock,
    selectWhereMock,
    insertMock,
    insertValuesMock,
    updateMock,
    updateSetMock,
    updateWhereMock,
    executeMock,
    transactionMock,
  }
})

vi.mock('@/db', () => ({
  default: {
    select: selectMock,
    insert: insertMock,
    update: updateMock,
    transaction: transactionMock,
  },
}))

import {
  createRoomType,
  listDeletedRoomTypes,
  listRoomTypes,
  restoreRoomType,
  softDeleteRoomType,
  updateRoomType,
  validateRoomTypeInput,
  type RoomTypeInput,
} from './room-types'

const RT_S = makeRoomType({ id: 'rt-s', code: 'S', typeName: 'ห้องทั่วไป' })
const RT_G = makeRoomType({
  id: 'rt-g',
  code: 'G',
  typeName: 'ห้องประชุมใหญ่',
  bookingMode: 'EXCLUSIVE',
  minDurationMinutes: 120,
})

function input(overrides: Partial<RoomTypeInput> = {}): RoomTypeInput {
  return {
    code: 'S',
    typeName: 'ห้องทั่วไป',
    bookingMode: 'CAPACITY',
    minDurationMinutes: 60,
    ...overrides,
  }
}

function deletedType(overrides: Partial<Parameters<typeof makeRoomType>[0]> = {}) {
  return makeRoomType({
    id: 'rt-old',
    deletedAt: new Date('2026-02-01T00:00:00Z'),
    deletedBy: 'a1',
    ...overrides,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  selectWhereMock.mockReset()
  insertValuesMock.mockReset().mockResolvedValue(undefined)
  updateWhereMock.mockReset().mockResolvedValue(undefined)
  executeMock.mockReset().mockResolvedValue(undefined)
})

describe('validateRoomTypeInput', () => {
  it('ปล่อยผ่านอินพุตที่ถูกต้อง', () => {
    expect(validateRoomTypeInput(input())).toBeNull()
  })

  it('รหัสต้องยาว 1 ตัวอักษร', () => {
    expect(validateRoomTypeInput(input({ code: 'SS' }))).toBeTypeOf('string')
    expect(validateRoomTypeInput(input({ code: '' }))).toBeTypeOf('string')
  })

  it('ต้องมีชื่อประเภทห้อง', () => {
    expect(validateRoomTypeInput(input({ typeName: '   ' }))).toBeTypeOf('string')
  })

  it('ชื่อประเภทห้องยาวเกิน 100 ตัวอักษรไม่ได้', () => {
    expect(validateRoomTypeInput(input({ typeName: 'ก'.repeat(101) }))).toBeTypeOf('string')
  })

  it('ระยะเวลาขั้นต่ำต้องเป็นจำนวนนาทีเต็มที่มากกว่า 0', () => {
    expect(validateRoomTypeInput(input({ minDurationMinutes: 0 }))).toBeTypeOf('string')
    expect(validateRoomTypeInput(input({ minDurationMinutes: -30 }))).toBeTypeOf('string')
    expect(validateRoomTypeInput(input({ minDurationMinutes: 1.5 }))).toBeTypeOf('string')
    expect(validateRoomTypeInput(input({ minDurationMinutes: Number.NaN }))).toBeTypeOf('string')
  })
})

describe('listRoomTypes', () => {
  it('คืนแถวแบบแคบเท่าที่ได้จาก query', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([RT_G, RT_S]))

    await expect(listRoomTypes()).resolves.toEqual([RT_G, RT_S])
  })
})

describe('listDeletedRoomTypes', () => {
  it('คืนเฉพาะรายการที่ถูกลบพร้อมข้อมูลผู้ลบ', async () => {
    const deleted = deletedType()

    selectWhereMock.mockReturnValueOnce(rowsQuery([deleted]))

    await expect(listDeletedRoomTypes()).resolves.toEqual([deleted])
  })
})

describe('createRoomType', () => {
  it('เพิ่มแถวใหม่เมื่อไม่พบรหัสหรือชื่อเดิม', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([]))

    const result = await createRoomType(input())

    expect(result).toEqual({ ok: true, restored: false })
    expect(insertValuesMock).toHaveBeenCalledWith({
      code: 'S',
      typeName: 'ห้องทั่วไป',
      bookingMode: 'CAPACITY',
      minDurationMinutes: 60,
    })
  })

  it('ปฏิเสธเมื่อรหัสซ้ำกับรายการที่ยังใช้งานอยู่ และไม่เขียนฐานข้อมูล', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([RT_S]))

    const result = await createRoomType(input())

    expect(result).toMatchObject({ ok: false })
    expect(insertMock).not.toHaveBeenCalled()
    expect(updateSetMock).not.toHaveBeenCalled()
  })

  it('ปฏิเสธเมื่อชื่อซ้ำกับรายการที่ยังใช้งานอยู่', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([makeRoomType({ id: 'rt-z', code: 'Z' })]))

    const result = await createRoomType(input({ code: 'S', typeName: 'ห้องทั่วไป' }))

    expect(result).toMatchObject({ ok: false })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('กู้คืนแถวเดิมเมื่อรหัสตรงกับรายการที่ถูกลบ แทนการสร้างใหม่', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([deletedType({ code: 'S' })]))

    const result = await createRoomType(input({ typeName: 'ห้องนั่งเล่น' }))

    expect(result).toEqual({ ok: true, restored: true })
    expect(insertMock).not.toHaveBeenCalled()
    expect(updateSetMock).toHaveBeenCalledWith({
      code: 'S',
      typeName: 'ห้องนั่งเล่น',
      bookingMode: 'CAPACITY',
      minDurationMinutes: 60,
      deletedAt: null,
      deletedBy: null,
    })
    expect(updateWhereMock).toHaveBeenCalledTimes(1)
  })

  it('กู้คืนตามชื่อเมื่อรหัสไม่ตรงกับแถวใด แต่ชื่อตรงกับรายการที่ถูกลบ', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([deletedType({ code: 'X', typeName: 'ห้องใหม่' })]))

    const result = await createRoomType(input({ code: 'S', typeName: 'ห้องใหม่' }))

    expect(result).toEqual({ ok: true, restored: true })
    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'S', typeName: 'ห้องใหม่', deletedAt: null, deletedBy: null }),
    )
  })

  it('แจ้งข้อผิดพลาดเมื่อรหัสและชื่อตรงกับแถวที่ถูกลบคนละแถว (ไม่เดา)', async () => {
    selectWhereMock.mockReturnValueOnce(
      rowsQuery([
        deletedType({ id: 'rt-1', code: 'S', typeName: 'ห้อง ก' }),
        deletedType({ id: 'rt-2', code: 'Y', typeName: 'ห้อง ข' }),
      ]),
    )

    const result = await createRoomType(input({ code: 'S', typeName: 'ห้อง ข' }))

    expect(result).toMatchObject({ ok: false })
    expect(updateSetMock).not.toHaveBeenCalled()
  })

  it('ตรวจสอบอินพุตก่อนแตะฐานข้อมูล', async () => {
    const result = await createRoomType(input({ code: 'SS' }))

    expect(result).toMatchObject({ ok: false })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it('ถือ advisory lock ก่อนอ่าน/เขียน เพื่อ serialize การแก้ไขประเภทห้อง', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([]))

    await createRoomType(input())

    expect(transactionMock).toHaveBeenCalledTimes(1)
    expect(executeMock).toHaveBeenCalledTimes(1)
    expect(executeMock.mock.invocationCallOrder[0]).toBeLessThan(
      insertValuesMock.mock.invocationCallOrder[0]!,
    )
  })

  it('แปลง unique violation (23505) เป็นข้อความที่เข้าใจได้', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([]))
    insertValuesMock.mockRejectedValueOnce(
      Object.assign(new Error('duplicate key'), { code: '23505' }),
    )

    const result = await createRoomType(input())

    expect(result).toMatchObject({ ok: false })
  })
})

describe('updateRoomType', () => {
  it('แก้ไขได้เมื่อรหัส/ชื่อไม่ชนกับรายการอื่น', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([RT_S]))
    selectWhereMock.mockReturnValueOnce(rowsQuery([]))

    const result = await updateRoomType('rt-s', input({ typeName: 'ห้องทั่วไป 2' }))

    expect(result).toEqual({ ok: true })
    expect(updateSetMock).toHaveBeenCalledWith({
      code: 'S',
      typeName: 'ห้องทั่วไป 2',
      bookingMode: 'CAPACITY',
      minDurationMinutes: 60,
    })
  })

  it('ปฏิเสธเมื่อรหัสซ้ำกับรายการอื่นที่ยังใช้งานอยู่', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([RT_S]))
    selectWhereMock.mockReturnValueOnce(rowsQuery([RT_G]))

    const result = await updateRoomType('rt-s', input({ code: 'G' }))

    expect(result).toMatchObject({ ok: false })
    expect(updateSetMock).not.toHaveBeenCalled()
  })

  it('ปฏิเสธเมื่อไม่พบรายการหรือถูกลบไปแล้ว', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([]))

    const result = await updateRoomType('missing', input())

    expect(result).toMatchObject({ ok: false })
    expect(updateSetMock).not.toHaveBeenCalled()
  })

  it('ตรวจสอบอินพุตก่อนแตะฐานข้อมูล', async () => {
    const result = await updateRoomType('rt-s', input({ minDurationMinutes: 0 }))

    expect(result).toMatchObject({ ok: false })
    expect(transactionMock).not.toHaveBeenCalled()
  })
})

describe('softDeleteRoomType', () => {
  it('บันทึก deleted_at และ deleted_by', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([RT_S]))

    const result = await softDeleteRoomType('rt-s', 'a1')

    expect(result).toEqual({ ok: true })
    expect(updateSetMock).toHaveBeenCalledWith({
      deletedAt: expect.any(Date),
      deletedBy: 'a1',
    })
  })

  it('ปฏิเสธพร้อมข้อความที่เข้าใจได้เมื่อ trigger กันการลบ (23001)', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([RT_S]))
    updateWhereMock.mockRejectedValueOnce(
      Object.assign(new Error('room_type still has active rooms'), { code: '23001' }),
    )

    const result = await softDeleteRoomType('rt-s', 'a1')

    expect(result).toMatchObject({ ok: false })
    expect((result as { message: string }).message).toContain('ห้อง')
  })
})

describe('restoreRoomType', () => {
  it('ล้าง deleted_at และ deleted_by', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([deletedType()]))
    selectWhereMock.mockReturnValueOnce(rowsQuery([]))

    const result = await restoreRoomType('rt-old')

    expect(result).toEqual({ ok: true, restored: true })
    expect(updateSetMock).toHaveBeenCalledWith({ deletedAt: null, deletedBy: null })
  })

  it('ปฏิเสธเมื่อรหัสถูกนำไปใช้แล้วระหว่างที่ถูกลบ', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([deletedType({ code: 'S' })]))
    selectWhereMock.mockReturnValueOnce(rowsQuery([RT_S]))

    const result = await restoreRoomType('rt-old')

    expect(result).toMatchObject({ ok: false })
    expect(updateSetMock).not.toHaveBeenCalled()
  })

  it('ปฏิเสธเมื่อไม่พบรายการ', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([]))

    const result = await restoreRoomType('missing')

    expect(result).toMatchObject({ ok: false })
  })
})
