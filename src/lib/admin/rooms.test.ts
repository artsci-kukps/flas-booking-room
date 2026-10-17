import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeRoom, makeRoomType } from './test-fixtures'

/**
 * จำลอง query ของ drizzle ที่ "await ได้" และ "ต่อ .orderBy() ได้"
 * ครอบทั้ง select เดี่ยว และ select ที่ join room_type
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
  const innerJoinMock = vi.fn(() => ({ where: selectWhereMock }))
  const fromMock = vi.fn(() => ({ where: selectWhereMock, innerJoin: innerJoinMock }))
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
    innerJoinMock,
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
  createRoom,
  listDeletedRooms,
  listRooms,
  restoreRoom,
  softDeleteRoom,
  updateRoom,
  validateRoomBasics,
  validateRoomInput,
  type RoomInput,
} from './rooms'

const RT_S = makeRoomType({ id: 'rt-s', code: 'S', typeName: 'ห้องทั่วไป', bookingMode: 'CAPACITY' })
const RT_G = makeRoomType({
  id: 'rt-g',
  code: 'G',
  typeName: 'ห้องประชุมใหญ่',
  bookingMode: 'EXCLUSIVE',
  minDurationMinutes: 120,
})

const ROOM_S101 = makeRoom({ id: 'r-101', name: 'S-101', roomTypeId: 'rt-s' })

function input(overrides: Partial<RoomInput> = {}): RoomInput {
  return {
    name: 'S-101',
    roomTypeId: 'rt-s',
    maxCapacity: 4,
    facilities: null,
    ...overrides,
  }
}

function deletedRoom(overrides: Partial<Parameters<typeof makeRoom>[0]> = {}) {
  return makeRoom({
    id: 'r-old',
    name: 'S-101',
    roomTypeId: 'rt-s',
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

describe('validateRoomBasics', () => {
  it('ปล่อยผ่านอินพุตที่ถูกต้อง', () => {
    expect(validateRoomBasics(input())).toBeNull()
  })

  it('ต้องมีชื่อห้องและต้องไม่ยาวเกิน 100 ตัวอักษร', () => {
    expect(validateRoomBasics(input({ name: '  ' }))).toBeTypeOf('string')
    expect(validateRoomBasics(input({ name: 'ก'.repeat(101) }))).toBeTypeOf('string')
  })

  it('ต้องเลือกประเภทห้อง', () => {
    expect(validateRoomBasics(input({ roomTypeId: '' }))).toBeTypeOf('string')
  })

  it('ความจุที่ระบุต้องเป็นจำนวนเต็มมากกว่า 0', () => {
    expect(validateRoomBasics(input({ maxCapacity: 0 }))).toBeTypeOf('string')
    expect(validateRoomBasics(input({ maxCapacity: -1 }))).toBeTypeOf('string')
    expect(validateRoomBasics(input({ maxCapacity: 1.5 }))).toBeTypeOf('string')
    expect(validateRoomBasics(input({ maxCapacity: null }))).toBeNull()
  })
})

describe('validateRoomInput', () => {
  it('ห้อง CAPACITY ต้องมีความจุ', () => {
    expect(validateRoomInput(input({ maxCapacity: null }), 'CAPACITY')).toBeTypeOf('string')
    expect(validateRoomInput(input({ maxCapacity: 5 }), 'CAPACITY')).toBeNull()
  })

  it('ห้อง EXCLUSIVE ไม่บังคับความจุ', () => {
    expect(validateRoomInput(input({ maxCapacity: null }), 'EXCLUSIVE')).toBeNull()
    expect(validateRoomInput(input({ maxCapacity: 5 }), 'EXCLUSIVE')).toBeNull()
  })
})

describe('listRooms', () => {
  it('คืนรายการห้องที่ยังใช้งานอยู่ พร้อมข้อมูลประเภทห้อง', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([ROOM_S101]))

    await expect(listRooms()).resolves.toEqual([ROOM_S101])
  })
})

describe('listDeletedRooms', () => {
  it('คืนเฉพาะรายการที่ถูกลบพร้อมข้อมูลผู้ลบ', async () => {
    const deleted = deletedRoom()

    selectWhereMock.mockReturnValueOnce(rowsQuery([deleted]))

    await expect(listDeletedRooms()).resolves.toEqual([deleted])
  })
})

describe('createRoom', () => {
  it('เพิ่มห้องใหม่เมื่อชื่อไม่ตรงกับแถวที่ถูกลบ', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([RT_S]))
    selectWhereMock.mockReturnValueOnce(rowsQuery([]))

    const result = await createRoom(input({ facilities: 'โปรเจกเตอร์' }))

    expect(result).toEqual({ ok: true, restored: false })
    expect(insertValuesMock).toHaveBeenCalledWith({
      name: 'S-101',
      roomTypeId: 'rt-s',
      maxCapacity: 4,
      facilities: 'โปรเจกเตอร์',
    })
  })

  it('ห้อง EXCLUSIVE ไม่บังคับความจุ (บันทึก null ได้)', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([RT_G]))
    selectWhereMock.mockReturnValueOnce(rowsQuery([]))

    const result = await createRoom(
      input({ name: 'G-1', roomTypeId: 'rt-g', maxCapacity: null }),
    )

    expect(result).toEqual({ ok: true, restored: false })
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ maxCapacity: null }),
    )
  })

  it('ปฏิเสธห้อง CAPACITY ที่ไม่ระบุความจุ โดยไม่เขียนฐานข้อมูล', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([RT_S]))

    const result = await createRoom(input({ maxCapacity: null }))

    expect(result).toMatchObject({ ok: false })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('ปฏิเสธเมื่อประเภทห้องที่เลือกไม่พบหรือถูกลบไปแล้ว', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([]))

    const result = await createRoom(input())

    expect(result).toMatchObject({ ok: false })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('ปฏิเสธเมื่อชื่อซ้ำกับห้องที่ยังใช้งานอยู่', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([RT_S]))
    selectWhereMock.mockReturnValueOnce(rowsQuery([{ id: 'r-101', name: 'S-101', deletedAt: null }]))

    const result = await createRoom(input())

    expect(result).toMatchObject({ ok: false })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('กู้คืนแถวเดิมเมื่อชื่อตรงกับห้องที่ถูกลบ แทนการสร้างใหม่', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([RT_S]))
    selectWhereMock.mockReturnValueOnce(
      rowsQuery([{ id: 'r-old', name: 'S-101', deletedAt: new Date('2026-02-01T00:00:00Z') }]),
    )

    const result = await createRoom(input({ maxCapacity: 8, facilities: 'ไวท์บอร์ด' }))

    expect(result).toEqual({ ok: true, restored: true })
    expect(insertMock).not.toHaveBeenCalled()
    expect(updateSetMock).toHaveBeenCalledWith({
      name: 'S-101',
      roomTypeId: 'rt-s',
      maxCapacity: 8,
      facilities: 'ไวท์บอร์ด',
      deletedAt: null,
      deletedBy: null,
    })
  })

  it('ตรวจกติกาพื้นฐานก่อนแตะฐานข้อมูล', async () => {
    const result = await createRoom(input({ name: '' }))

    expect(result).toMatchObject({ ok: false })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it('ถือ advisory lock ก่อนอ่าน/เขียน', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([RT_S]))
    selectWhereMock.mockReturnValueOnce(rowsQuery([]))

    await createRoom(input())

    expect(executeMock).toHaveBeenCalledTimes(1)
    expect(executeMock.mock.invocationCallOrder[0]).toBeLessThan(
      insertValuesMock.mock.invocationCallOrder[0]!,
    )
  })

  it('แปลง unique violation (23505) เป็นข้อความที่เข้าใจได้', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([RT_S]))
    selectWhereMock.mockReturnValueOnce(rowsQuery([]))
    insertValuesMock.mockRejectedValueOnce(
      Object.assign(new Error('duplicate key'), { code: '23505' }),
    )

    const result = await createRoom(input())

    expect(result).toMatchObject({ ok: false })
  })
})

describe('updateRoom', () => {
  it('แก้ไขห้องได้เมื่อชื่อไม่ชนกับห้องอื่น', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([{ id: 'r-101', name: 'S-101', deletedAt: null }]))
    selectWhereMock.mockReturnValueOnce(rowsQuery([RT_S]))
    selectWhereMock.mockReturnValueOnce(rowsQuery([]))

    const result = await updateRoom('r-101', input({ name: 'S-102' }))

    expect(result).toEqual({ ok: true })
    expect(updateSetMock).toHaveBeenCalledWith({
      name: 'S-102',
      roomTypeId: 'rt-s',
      maxCapacity: 4,
      facilities: null,
    })
  })

  it('ปฏิเสธเมื่อไม่พบห้องหรือถูกลบไปแล้ว', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([]))

    const result = await updateRoom('missing', input())

    expect(result).toMatchObject({ ok: false })
    expect(updateSetMock).not.toHaveBeenCalled()
  })

  it('ปฏิเสธเมื่อชื่อซ้ำกับห้องอื่นที่ยังใช้งานอยู่', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([{ id: 'r-101', name: 'S-101', deletedAt: null }]))
    selectWhereMock.mockReturnValueOnce(rowsQuery([RT_S]))
    selectWhereMock.mockReturnValueOnce(rowsQuery([{ id: 'r-999', name: 'S-102', deletedAt: null }]))

    const result = await updateRoom('r-101', input({ name: 'S-102' }))

    expect(result).toMatchObject({ ok: false })
    expect(updateSetMock).not.toHaveBeenCalled()
  })

  it('ย้ายห้องจาก EXCLUSIVE ไป CAPACITY ได้เมื่อระบุความจุ', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([{ id: 'r-101', name: 'G-1', deletedAt: null }]))
    selectWhereMock.mockReturnValueOnce(rowsQuery([RT_S]))
    selectWhereMock.mockReturnValueOnce(rowsQuery([]))

    const result = await updateRoom(
      'r-101',
      input({ name: 'S-1', roomTypeId: 'rt-s', maxCapacity: 5 }),
    )

    expect(result).toEqual({ ok: true })
    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ roomTypeId: 'rt-s', maxCapacity: 5 }),
    )
  })

  it('ปฏิเสธเมื่อย้ายไปประเภท CAPACITY แต่ไม่ระบุความจุ', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([{ id: 'r-101', name: 'S-1', deletedAt: null }]))
    selectWhereMock.mockReturnValueOnce(rowsQuery([RT_S]))

    const result = await updateRoom(
      'r-101',
      input({ name: 'S-1', roomTypeId: 'rt-s', maxCapacity: null }),
    )

    expect(result).toMatchObject({ ok: false })
    expect(updateSetMock).not.toHaveBeenCalled()
  })
})

describe('softDeleteRoom', () => {
  it('บันทึก deleted_at และ deleted_by', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([{ id: 'r-101', deletedAt: null }]))

    const result = await softDeleteRoom('r-101', 'a1')

    expect(result).toEqual({ ok: true })
    expect(updateSetMock).toHaveBeenCalledWith({
      deletedAt: expect.any(Date),
      deletedBy: 'a1',
    })
  })

  it('ปฏิเสธเมื่อไม่พบห้อง', async () => {
    selectWhereMock.mockReturnValueOnce(rowsQuery([]))

    const result = await softDeleteRoom('missing', 'a1')

    expect(result).toMatchObject({ ok: false })
  })
})

describe('restoreRoom', () => {
  it('ล้าง deleted_at และ deleted_by', async () => {
    selectWhereMock.mockReturnValueOnce(
      rowsQuery([{ id: 'r-old', name: 'S-101', deletedAt: new Date('2026-02-01T00:00:00Z') }]),
    )
    selectWhereMock.mockReturnValueOnce(rowsQuery([]))

    const result = await restoreRoom('r-old')

    expect(result).toEqual({ ok: true, restored: true })
    expect(updateSetMock).toHaveBeenCalledWith({ deletedAt: null, deletedBy: null })
  })

  it('ปฏิเสธเมื่อชื่อถูกใช้โดยห้องที่ใช้งานอยู่', async () => {
    selectWhereMock.mockReturnValueOnce(
      rowsQuery([{ id: 'r-old', name: 'S-101', deletedAt: new Date('2026-02-01T00:00:00Z') }]),
    )
    selectWhereMock.mockReturnValueOnce(rowsQuery([{ id: 'r-101', name: 'S-101' }]))

    const result = await restoreRoom('r-old')

    expect(result).toMatchObject({ ok: false })
    expect(updateSetMock).not.toHaveBeenCalled()
  })
})
