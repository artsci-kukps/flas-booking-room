import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { BLOCK_LENGTH_COPY } from '@/lib/booking/slot-display'

import CreativeSpaceRules from './creative-space-rules'

describe('ผนังกติกาการใช้ห้องของหน้าเข้าสู่ระบบ', () => {
  const html = renderToStaticMarkup(<CreativeSpaceRules />)

  it('อ้างที่มาจาก TOR.md อย่างชัดเจน', () => {
    expect(html).toContain('กติกาการเข้าใช้งานห้อง')
    expect(html).toContain('TOR.md')
  })

  it('สรุปประเภทห้องและโหมดการจองจาก TOR ข้อ 4', () => {
    expect(html).toContain('ประเภทห้อง')
    expect(html).toContain('ห้องประชุมใหญ่')
    expect(html).toContain('ห้องละหมาด')
    expect(html).toContain('จองทับกันได้ตามความจุ')
    expect(html).toContain('อย่างน้อย 2 ชั่วโมง')
  })

  it('สรุปเวลาให้บริการจาก TOR ข้อ 5', () => {
    expect(html).toContain('เวลาทำการ')
    expect(html).toContain('08:30–16:30')
    expect(html).toContain('08:30–20:30')
    expect(html).toContain('วันเสาร์–อาทิตย์')
  })

  it('สรุปการเลือกช่วงเวลาและการรวมบล็อกจาก TOR ข้อ 6.1', () => {
    expect(html).toContain('การเลือกช่วงเวลา')
    expect(html).toContain('บล็อกติดกันรวมเป็นรายการเดียว')
    expect(html).toContain('บล็อกที่มีช่วงว่างคั่น')
  })

  it('อธิบายความยาวบล็อกตามประเภทห้อง (ไม่ใช้ข้อความบล็อกละ 1 ชั่วโมงสำหรับทุกห้อง)', () => {
    expect(html).not.toContain('เลือกเป็นบล็อกละ 1 ชั่วโมง')
    expect(html).toContain('ห้องทั่วไป/ละหมาด บล็อกละ 1 ชั่วโมง')
    expect(html).toContain('ห้องประชุมใหญ่ บล็อกละ 2 ชั่วโมง')
  })

  it('ข้อความความยาวบล็อกมาจากชุดข้อความกลางของระบบ (ไม่คัดลอกข้อความไว้เอง)', () => {
    expect(html).toContain(BLOCK_LENGTH_COPY)
  })

  it('สรุปการป้องกันการจองซ้อนจาก TOR ข้อ 6.2', () => {
    expect(html).toContain('ห้องทั่วไปจองทับได้ตามความจุ')
  })

  it('สรุปการรับ–คืนกุญแจและกติกา NO_SHOW จาก TOR ข้อ 7–8', () => {
    expect(html).toContain('การรับ–คืนกุญแจ')
    expect(html).toContain('รับกุญแจด้วยรหัส 6 หลัก')
    expect(html).toContain('ภายใน 30 นาที')
    expect(html).toContain('NO_SHOW')
    expect(html).toContain('LATE_RETURN')
  })

  it('คงกติกาชุดเดียวกับหน้าจองห้อง (มารับกุญแจ/ยกเลิก/จองซ้อน)', () => {
    expect(html).toContain('มารับกุญแจภายใน 30 นาที')
    expect(html).toContain('ยกเลิกได้เองก่อนเริ่มใช้งาน')
    expect(html).toContain('ห้ามจองซ้อนช่วงเวลาเดียวกัน')
    expect(html).toContain('ความหมายของสถานะ')
  })
})
