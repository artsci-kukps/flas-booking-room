import { beforeEach, describe, expect, it, vi } from 'vitest'

const { selectMock, insertMock, insertValuesMock, deleteMock, deleteReturningMock } =
  vi.hoisted(() => {
    const deleteReturningMock = vi.fn<(input?: unknown) => Promise<{ id: string }[]>>(
      async () => [],
    )
    const deleteWhereMock = vi.fn(() => ({ returning: deleteReturningMock }))
    const deleteMock = vi.fn(() => ({ where: deleteWhereMock }))

    const insertValuesMock = vi.fn(async () => undefined)
    const insertMock = vi.fn(() => ({ values: insertValuesMock }))

    const selectMock = vi.fn()

    return {
      selectMock,
      insertMock,
      insertValuesMock,
      deleteMock,
      deleteReturningMock,
    }
  })

vi.mock('@/db', () => ({
  default: {
    select: selectMock,
    insert: insertMock,
    delete: deleteMock,
  },
}))

import { createRoomBlock, deleteRoomBlock, listRoomBlocks, parseBangkokDateTimeLocal, validateRoomBlockInput, type RoomBlockInput } from './room-blocks'

/**
 * จำลอง query ของ drizzle ที่ต่อ .innerJoin()/.orderBy() ได้หลายชั้น
 * และ "await ได้" ตรงตัว — ใช้กับ listRoomBlocks ที่ join rooms/users
 */
function listQuery(rows: unknown[]) {
  const chain: {
    from: () => typeof chain
    innerJoin: () => typeof chain
    orderBy: () => Promise<unknown[]>
    then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) => unknown
  } = {
    from: () => chain,
    innerJoin: () => chain,
    orderBy: () => Promise.resolve(rows),
    then: (resolve, reject) => Promise.resolve(rows).then(resolve, reject),
  }
  return chain
}

function input(overrides: Partial<RoomBlockInput> = {}): RoomBlockInput {
  return {
    roomId: 'r-1',
    startTime: new Date('2026-03-01T02:00:00Z'),
    endTime: new Date('2026-03-01T05:00:00Z'),
    reason: 'ปิดปรับปรุงแอร์',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  insertValuesMock.mockReset().mockResolvedValue(undefined)
  deleteReturningMock.mockReset().mockResolvedValue([])
})

describe('validateRoomBlockInput', () => {
  it('ปล่อยผ่านอินพุตที่ถูกต้อง', () => {
    expect(validateRoomBlockInput(input())).toBeNull()
  })

  it('บังคับการเลือกห้อง', () => {
    expect(validateRoomBlockInput(input({ roomId: '  ' }))).toBeTypeOf('string')
  })

  it('บังคับเหตุผล', () => {
    expect(validateRoomBlockInput(input({ reason: '   ' }))).toBeTypeOf('string')
  })

  it('ปฏิเสธเหตุผลที่ยาวเกิน 500 ตัวอักษร', () => {
    expect(validateRoomBlockInput(input({ reason: 'x'.repeat(501) }))).toBeTypeOf('string')
  })

  it('บังคับเวลาเริ่มต้น', () => {
    expect(validateRoomBlockInput(input({ startTime: null }))).toBeTypeOf('string')
  })

  it('บังคับเวลาสิ้นสุด', () => {
    expect(validateRoomBlockInput(input({ endTime: null }))).toBeTypeOf('string')
  })

  it('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น', () => {
    const start = new Date('2026-03-01T02:00:00Z')

    expect(validateRoomBlockInput(input({ startTime: start, endTime: start }))).toBeTypeOf('string')
  })
})

describe('parseBangkokDateTimeLocal', () => {
  it('แปลงค่าจากช่อง datetime-local เป็นเวลา UTC ตามเขต Asia/Bangkok (UTC+7)', () => {
    expect(parseBangkokDateTimeLocal('2026-03-01T09:00')).toEqual(new Date('2026-03-01T02:00:00Z'))
  })

  it('คืนค่า null เมื่อรูปแบบไม่ถูกต้อง', () => {
    expect(parseBangkokDateTimeLocal('01/03/2026 09:00')).toBeNull()
    expect(parseBangkokDateTimeLocal('2026-03-01')).toBeNull()
  })

  it('คืนค่า null เมื่อวัน/เวลาอยู่นอกช่วง', () => {
    expect(parseBangkokDateTimeLocal('2026-02-30T09:00')).toBeNull()
    expect(parseBangkokDateTimeLocal('2026-03-01T99:00')).toBeNull()
  })
})

describe('createRoomBlock', () => {
  it('เพิ่มบล็อกพร้อมผู้สร้างและคืน ok', async () => {
    const result = await createRoomBlock(input(), 'a1')

    expect(insertValuesMock).toHaveBeenCalledWith({
      roomId: 'r-1',
      startTime: new Date('2026-03-01T02:00:00Z'),
      endTime: new Date('2026-03-01T05:00:00Z'),
      reason: 'ปิดปรับปรุงแอร์',
      createdBy: 'a1',
    })
    expect(result).toEqual({ ok: true })
  })

  it('ปฏิเสธอินพุตที่ไม่ผ่านการตรวจก่อนแตะฐานข้อมูล', async () => {
    const result = await createRoomBlock(input({ reason: ' ' }), 'a1')

    expect(result).toMatchObject({ ok: false })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('แปล exclusion violation (23P01) เป็นข้อความไทยเมื่อช่วงเวลาทับกับบล็อกเดิม', async () => {
    insertValuesMock.mockRejectedValue({ code: '23P01' })

    const result = await createRoomBlock(input(), 'a1')

    expect(result).toMatchObject({ ok: false })
    expect((result as { ok: false; message: string }).message).toContain('ทับ')
  })

  it('โยนข้อผิดพลาดที่ไม่รู้จักต่อไป', async () => {
    insertValuesMock.mockRejectedValue(new Error('boom'))

    await expect(createRoomBlock(input(), 'a1')).rejects.toThrow('boom')
  })
})

describe('listRoomBlocks', () => {
  it('คืนแถวพร้อมชื่อห้องและชื่อผู้สร้าง เรียงตามเวลาเริ่มต้น', async () => {
    const rows = [
      {
        id: 'rb-1',
        roomId: 'r-1',
        roomName: 'S-101',
        startTime: new Date('2026-03-01T02:00:00Z'),
        endTime: new Date('2026-03-01T05:00:00Z'),
        reason: 'ปิดปรับปรุงแอร์',
        createdBy: 'a1',
        createdByName: 'ผู้ดูแล ระบบ',
        createdByEmail: 'admin@ku.th',
        createdAt: new Date('2026-02-20T03:00:00Z'),
      },
    ]
    selectMock.mockReturnValue(listQuery(rows))

    await expect(listRoomBlocks()).resolves.toEqual(rows)
  })
})

describe('deleteRoomBlock', () => {
  it('ลบจริง (hard delete) ด้วย id แล้วคืน ok', async () => {
    deleteReturningMock.mockResolvedValue([{ id: 'rb-1' }])

    const result = await deleteRoomBlock('rb-1')

    expect(deleteMock).toHaveBeenCalledTimes(1)
    expect(deleteReturningMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ ok: true })
  })

  it('คืนข้อความไทยเมื่อไม่พบรายการ (ถูกลบไปแล้ว)', async () => {
    deleteReturningMock.mockResolvedValue([])

    const result = await deleteRoomBlock('rb-missing')

    expect(result).toMatchObject({ ok: false })
  })
})
