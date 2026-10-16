import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import Alert from './alert'

describe('Global Alert', () => {
  it('ค่าเริ่มต้นเป็น danger และประกาศด้วย role="alert"', () => {
    const html = renderToStaticMarkup(<Alert heading="หัวข้อ" body="รายละเอียด" />)

    expect(html).toContain('role="alert"')
    expect(html).toContain('bg-danger-soft')
    expect(html).toContain('border-danger-line')
    expect(html).toContain('หัวข้อ')
    expect(html).toContain('รายละเอียด')
  })

  it('โทน success ใช้เขียวแบรนด์และประกาศแบบ polite (status)', () => {
    const html = renderToStaticMarkup(
      <Alert tone="success" heading="สำเร็จ" body="เรียบร้อย" />,
    )

    expect(html).toContain('role="status"')
    expect(html).toContain('bg-ku-soft')
    expect(html).toContain('text-ku')
  })

  it('โทน warning ใช้ amber โดยไม่แตะ accent อื่น', () => {
    const html = renderToStaticMarkup(
      <Alert tone="warning" heading="ระวัง" body="ตรวจสอบอีกครั้ง" />,
    )

    expect(html).toContain('bg-amber-soft')
    expect(html).toContain('text-amber-ink')
    expect(html).not.toContain('bg-ku-soft')
  })

  it('โทน info ใช้โทนกลาง ไม่ใช้น้ำเงิน/ม่วงที่เป็นสีหมวดหมู่ห้อง', () => {
    const html = renderToStaticMarkup(
      <Alert tone="info" heading="ข้อมูล" body="รายละเอียด" />,
    )

    expect(html).toContain('bg-canvas')
    expect(html).not.toContain('bg-blue-soft')
    expect(html).not.toContain('bg-violet-soft')
  })

  it('มีไอคอน SVG ที่เขียนเองและไม่ใช้ emoji', () => {
    const html = renderToStaticMarkup(<Alert heading="หัวข้อ" body="รายละเอียด" />)

    expect(html).toContain('<svg')
    expect(html).toContain('stroke-width="1.8"')
  })

  it('แทรกปุ่มการกระทำและเนื้อหาแบบกำหนดเองได้', () => {
    const html = renderToStaticMarkup(
      <Alert heading="หัวข้อ" action={<button type="button">ลองใหม่</button>}>
        <p>เนื้อหาเสริม</p>
      </Alert>,
    )

    expect(html).toContain('เนื้อหาเสริม')
    expect(html).toContain('ลองใหม่')
  })
})
