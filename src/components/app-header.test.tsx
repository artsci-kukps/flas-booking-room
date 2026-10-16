import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { pathnameMock } = vi.hoisted(() => ({ pathnameMock: { value: '/user/booking' } }))

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameMock.value,
  useRouter: () => ({ push: vi.fn() }),
}))

import AppHeader from './app-header'

const USER = {
  fullName: 'ผู้ใช้ ทดสอบ',
  email: 'user@ku.th',
  imageUrl: null,
}

const ADMIN = {
  fullName: 'ผู้ดูแล ระบบ',
  email: 'admin@ku.th',
  imageUrl: null,
}

describe('app header navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pathnameMock.value = '/user/booking'
  })

  it('shows only the /user routes to a regular user', () => {
    const html = renderToStaticMarkup(<AppHeader user={{ ...USER, role: 'user' }} />)

    expect(html).toContain('href="/user/booking"')
    expect(html).toContain('href="/user/history"')
    expect(html).not.toContain('/admin/')
  })

  it('shows only the /admin routes to an admin', () => {
    pathnameMock.value = '/admin/booking'

    const html = renderToStaticMarkup(<AppHeader user={{ ...ADMIN, role: 'admin' }} />)

    expect(html).toContain('href="/admin/booking"')
    expect(html).toContain('href="/admin/booking-management"')
    expect(html).not.toContain('/user/')
  })

  it('marks the current admin page with aria-current', () => {
    pathnameMock.value = '/admin/history'

    const html = renderToStaticMarkup(<AppHeader user={{ ...ADMIN, role: 'admin' }} />)

    expect(html).toContain('aria-current="page"')
    expect(html).toMatch(/aria-current="page"[^>]*href="\/admin\/history"/)
  })
})
