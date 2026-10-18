import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import type { Reservation } from '@/db/schema'

import { computeRoomSlots, OCCUPYING_STATUSES } from './day-availability'
import {
  isNoShowCandidate,
  NO_SHOW_GRACE_MINUTES,
  noShowCutoff,
  selectNoShowReservations,
  type NoShowCandidate,
} from './no-show'

/**
 * กฎ NO_SHOW อัตโนมัติ (TOR ข้อ 7):
 * "ถ้ายังเป็น PENDING และเวลาผ่านไปเกิน start_time + 30 นาที → NO_SHOW"
 *
 * เกณฑ์ตัดสินเป็น "instant" ล้วน (start_time + 30 นาที เทียบกับ now) จึงไม่ขึ้นกับ
 * timezone ของเซิร์ฟเวอร์ — เทสต์จำลองเหตุการณ์ข้ามเที่ยงคืน Bangkok เพื่อยืนยัน
 * ว่าไม่มีการเผลอใช้ตัวเลขวันที่ (calendar date) ในการตัดสิน
 */

type Status = Reservation['status']

const BANGKOK = '+07:00'

/** instant จากเวลาหน้าปัดของวันหนึ่งใน Asia/Bangkok (time = 'HH:MM' หรือ 'HH:MM:SS') */
function bangkok(date: string, time: string): Date {
  const clock = time.length === 5 ? `${time}:00` : time

  return new Date(`${date}T${clock}${BANGKOK}`)
}

function candidate(status: Status, startTime: Date): NoShowCandidate {
  return { status, startTime }
}

describe('noShowCutoff', () => {
  it('คือ start_time + 30 นาที (instant เดียวกัน ไม่ผูก timezone)', () => {
    expect(NO_SHOW_GRACE_MINUTES).toBe(30)

    const cutoff = noShowCutoff(bangkok('2026-10-19', '08:30'))

    expect(cutoff.toISOString()).toBe('2026-10-19T02:00:00.000Z') // 09:00 +07:00
  })

  it('ไม่แก้ไข Date ต้นทาง (คืนค่าใหม่)', () => {
    const start = bangkok('2026-10-19', '08:30')
    const original = start.getTime()

    noShowCutoff(start)

    expect(start.getTime()).toBe(original)
  })
})

describe('isNoShowCandidate', () => {
  it('PENDING เกิน start_time + 30 นาที → true (รวมเวลาเท่ากับเส้นตัดพอดี)', () => {
    const start = bangkok('2026-10-19', '08:30')

    expect(isNoShowCandidate(candidate('PENDING', start), bangkok('2026-10-19', '09:00'))).toBe(true)
    expect(isNoShowCandidate(candidate('PENDING', start), bangkok('2026-10-19', '09:01'))).toBe(true)
  })

  it('PENDING ยังไม่ถึง start_time + 30 นาที → false', () => {
    const start = bangkok('2026-10-19', '08:30')

    expect(isNoShowCandidate(candidate('PENDING', start), bangkok('2026-10-19', '08:59'))).toBe(false)
    expect(isNoShowCandidate(candidate('PENDING', start), bangkok('2026-10-19', '08:30'))).toBe(false)
  })

  it('ไม่แตะสถานะอื่นเลย (แม้เลยเส้นตัดไปไกล)', () => {
    const start = bangkok('2026-10-19', '08:30')
    const now = bangkok('2026-10-19', '12:00')
    const others: Status[] = ['ACTIVE', 'COMPLETED', 'LATE_RETURN', 'CANCELLED', 'NO_SHOW']

    for (const status of others) {
      expect(isNoShowCandidate(candidate(status, start), now)).toBe(false)
    }
  })
})

describe('selectNoShowReservations', () => {
  it('เลือกเฉพาะ PENDING ที่เลยเส้นตัด คงลำดับเดิม และไม่แก้ array ต้นทาง', () => {
    const rows = [
      candidate('ACTIVE', bangkok('2026-10-19', '08:30')),
      candidate('PENDING', bangkok('2026-10-19', '08:30')), // เลยเส้นตัด
      candidate('COMPLETED', bangkok('2026-10-19', '08:30')),
      candidate('PENDING', bangkok('2026-10-19', '11:45')), // ยังไม่ถึง
      candidate('PENDING', bangkok('2026-10-19', '07:30')), // เลยเส้นตัด
    ]
    const now = bangkok('2026-10-19', '12:00')

    const selected = selectNoShowReservations(rows, now)

    expect(selected).toEqual([rows[1], rows[4]])
    expect(rows).toHaveLength(5) // ของเดิมไม่ถูกแตะ
  })

  it('คืน array ว่างเมื่อไม่มีใครครบเงื่อนไข', () => {
    const rows = [
      candidate('PENDING', bangkok('2026-10-19', '11:45')),
      candidate('ACTIVE', bangkok('2026-10-19', '07:00')),
    ]

    expect(selectNoShowReservations(rows, bangkok('2026-10-19', '12:00'))).toEqual([])
  })
})

describe('ขอบเขตข้ามเที่ยงคืน Bangkok', () => {
  it('การจอง 23:45 Bangkok ครบ 30 นาทีเป็น 00:15 ของวันถัดไป (Bangkok)', () => {
    const start = bangkok('2026-10-19', '23:45')
    const cutoff = noShowCutoff(start)

    // 23:45+07:00 = 16:45Z, +30 นาที = 17:15Z = 00:15 ของวันถัดไป (Bangkok)
    expect(start.toISOString()).toBe('2026-10-19T16:45:00.000Z')
    expect(cutoff.toISOString()).toBe('2026-10-19T17:15:00.000Z')

    // ยังอยู่ในวัน Bangkok เดิม → ยังไม่ NO_SHOW
    expect(isNoShowCandidate(candidate('PENDING', start), bangkok('2026-10-19', '23:59:59'))).toBe(false)
    // ข้ามเที่ยงคืนแล้วแต่ยังไม่ครบ 30 นาที → ยังไม่ NO_SHOW
    expect(isNoShowCandidate(candidate('PENDING', start), bangkok('2026-10-20', '00:00:00'))).toBe(false)
    // ครบ 30 นาทีพอดี (เป็นวัน Bangkok ถัดไป) → NO_SHOW
    expect(isNoShowCandidate(candidate('PENDING', start), bangkok('2026-10-20', '00:15:00'))).toBe(true)
  })

  it('เลือกด้วย instant ล้วน — ไม่ขึ้นกับปฏิทินวันของ start_time หรือ timezone เซิร์ฟเวอร์', () => {
    // start เดียวกันแต่สร้างจากสตริง UTC ตรง ๆ (16:45Z = 23:45 Bangkok)
    const rows = [candidate('PENDING', new Date('2026-10-19T16:45:00.000Z'))]
    const afterMidnight = new Date('2026-10-19T17:20:00.000Z') // 00:20 Bangkok วันถัดไป

    expect(selectNoShowReservations(rows, afterMidnight)).toEqual(rows)
  })
})

describe('ปล่อยช่องว่างทันทีเมื่อเป็น NO_SHOW', () => {
  it('NO_SHOW ไม่ใช่สถานะที่ครองช่วงเวลา — มีเพียง PENDING/ACTIVE (exclusion constraint)', () => {
    expect([...OCCUPYING_STATUSES]).toEqual(['PENDING', 'ACTIVE'])
    expect(OCCUPYING_STATUSES).not.toContain('NO_SHOW')
  })

  it('ช่องที่เคยถูกครองโดย PENDING กลับมาเลือกได้เมื่อรายการกลายเป็น NO_SHOW', () => {
    const date = '2026-10-19'
    const slots = [{ start: '08:30', end: '09:30' }]
    const range = { startTime: bangkok(date, '08:30'), endTime: bangkok(date, '09:30') }

    // จำลอง filter เดียวกับ query (TOR A.5: นับเฉพาะ OCCUPYING_STATUSES)
    const occupyingOf = (status: Status): { startTime: Date; endTime: Date }[] =>
      ([{ status, ...range }] as { status: Status; startTime: Date; endTime: Date }[])
        .filter((row) => (OCCUPYING_STATUSES as readonly string[]).includes(row.status))
        .map((row) => ({ startTime: row.startTime, endTime: row.endTime }))

    const now = bangkok(date, '08:00')

    const pending = computeRoomSlots({
      date,
      slots,
      bookingMode: 'EXCLUSIVE',
      maxCapacity: null,
      reservations: occupyingOf('PENDING'),
      blocks: [],
      now,
    })

    const noShow = computeRoomSlots({
      date,
      slots,
      bookingMode: 'EXCLUSIVE',
      maxCapacity: null,
      reservations: occupyingOf('NO_SHOW'),
      blocks: [],
      now,
    })

    expect(pending[0]).toMatchObject({ status: 'occupied', selectable: false })
    expect(noShow[0]).toMatchObject({ status: 'free', selectable: true })
  })
})

describe('migration pg_cron สอดคล้องกับกฎในโค้ด', () => {
  const sql = readFileSync(new URL('../../../drizzle/0002_no_show_cron.sql', import.meta.url), 'utf8')

  it('ตั้งเฉพาะ PENDING ที่เลย 30 นาที เป็น NO_SHOW', () => {
    expect(sql).toContain(`"status" = 'PENDING'`)
    expect(sql).toContain(`interval '30 minutes'`)
    expect(sql).toContain(`'NO_SHOW'`)
  })

  it('ลงทะเบียน cron ด้วยชื่อคงที่และความถี่ที่ตกลง (ทุกนาที)', () => {
    expect(sql).toContain('cron.schedule')
    expect(sql).toContain(`'reservation-no-show'`)
    expect(sql).toContain(`'* * * * *'`)
  })
})
