import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./src/test/server-only.ts', import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        // เดิม: ทดสอบฝั่ง node ทั้งหมด (environment: node) — ไม่แตะไฟล์ *.dom.test.tsx
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['src/**/*.dom.test.{ts,tsx}'],
        },
      },
      {
        // ใหม่: ทดสอบ DOM (environment: jsdom) — คลิก/พิมพ์/ส่งฟอร์มได้จริง
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.dom.test.{ts,tsx}'],
          setupFiles: ['./src/test/dom-setup.ts'],
        },
      },
    ],
  },
})
