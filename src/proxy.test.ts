import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'

import { config, proxy } from './proxy'

const AUTH_COOKIE = 'sb-localhost-auth-token'

function request(path: string, cookies: Record<string, string> = {}) {
  const req = new NextRequest(`http://localhost${path}`)
  for (const [name, value] of Object.entries(cookies)) {
    req.cookies.set(name, value)
  }
  return req
}

describe('proxy matcher', () => {
  const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url })

  it('matches protected app routes', () => {
    expect(matches('/')).toBe(true)
    expect(matches('/profile')).toBe(true)
    expect(matches('/admin')).toBe(true)
  })

  it('excludes the public auth routes', () => {
    expect(matches('/login')).toBe(false)
    expect(matches('/auth/callback')).toBe(false)
    expect(matches('/blocked')).toBe(false)
  })

  it('excludes framework and static assets', () => {
    expect(matches('/_next/static/chunks/main.js')).toBe(false)
    expect(matches('/_next/image')).toBe(false)
    expect(matches('/favicon.ico')).toBe(false)
    expect(matches('/logo.svg')).toBe(false)
  })
})

describe('proxy redirect', () => {
  it('redirects an unauthenticated request to /login', () => {
    const response = proxy(request('/profile'))

    expect(response?.status).toBe(307)
    expect(response?.headers.get('location')).toBe('http://localhost/login')
  })

  it('lets a request with a Supabase session cookie through', () => {
    const response = proxy(request('/profile', { [AUTH_COOKIE]: 'jwt' }))

    expect(response?.headers.get('location')).toBeNull()
  })

  it('treats a chunked Supabase session cookie as signed in', () => {
    const response = proxy(request('/admin', { [`${AUTH_COOKIE}.0`]: 'jwt' }))

    expect(response?.headers.get('location')).toBeNull()
  })

  it('does not treat the auth-token code verifier as a session', () => {
    const response = proxy(request('/profile', { [`${AUTH_COOKIE}-code-verifier`]: 'x' }))

    expect(response?.headers.get('location')).toBe('http://localhost/login')
  })
})
