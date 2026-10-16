import { describe, expect, it } from 'vitest'
import { isKuEmail } from './ku-email'

// semantics ต้องตรงกับ CHECK ของ DB: lower(email) LIKE '%@ku.th'
describe('isKuEmail', () => {
  it('accepts a lowercase @ku.th address', () => {
    expect(isKuEmail('user@ku.th')).toBe(true)
  })

  it('accepts an uppercase @KU.TH address', () => {
    expect(isKuEmail('USER@KU.TH')).toBe(true)
  })

  it('accepts a mixed-case @Ku.Th address', () => {
    expect(isKuEmail('Mixed.Case@Ku.Th')).toBe(true)
  })

  it('rejects a non-university domain', () => {
    expect(isKuEmail('user@gmail.com')).toBe(false)
  })

  it('rejects a subdomain of ku.th', () => {
    expect(isKuEmail('user@sub.ku.th')).toBe(false)
  })

  it('rejects a ku.th look-alike suffix', () => {
    expect(isKuEmail('user@ku.th.evil')).toBe(false)
  })

  it('rejects null', () => {
    expect(isKuEmail(null)).toBe(false)
  })

  it('rejects undefined', () => {
    expect(isKuEmail(undefined)).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isKuEmail('')).toBe(false)
  })
})
