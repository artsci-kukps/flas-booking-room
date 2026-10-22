import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

/**
 * ตั้งค่าสำหรับไฟล์ทดสอบ DOM (environment: jsdom) — โปรเจกต์ "dom" ใน vitest.config.mts
 *
 * - `@testing-library/jest-dom/vitest` เพิ่ม matcher เช่น toBeDisabled/toBeEnabled/toHaveTextContent
 * - `cleanup()` ล้าง DOM หลังจบแต่ละเทสต์ — RTL ลงทะเบียนให้อัตโนมัติเมื่อมี global afterEach
 *   แต่โปรเจกต์นี้ไม่ได้เปิด `globals: true` (repo import describe/it/expect จาก "vitest" ตรง ๆ)
 *   จึงต้องลงทะเบียน cleanup เองที่นี่
 */

/*
 * jsdom ยังไม่ทำ HTMLDialogElement.showModal()/close() — popup จองในตารางเป็น <dialog>
 * (src/components/booking/grid-booking-dialog.tsx) ทำแผ่นข้างต้นให้เล็กน้อย
 * เพื่อให้ popup เปิด/ปิดและยิง event "close" ได้เหมือนเบราว์เซอร์
 */
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(): void {
      this.open = true
    }
  }

  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close(): void {
      this.open = false
      this.dispatchEvent(new Event('close'))
    }
  }
}

afterEach(() => {
  cleanup()
})
