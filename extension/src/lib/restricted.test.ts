import { describe, expect, it } from 'vitest'
import { isRestrictedUrl } from './restricted'

describe('isRestrictedUrl', () => {
  it('flags chrome internal pages', () => {
    expect(isRestrictedUrl('chrome://extensions')).toBe(true)
  })
  it('flags the chrome web store', () => {
    expect(isRestrictedUrl('https://chromewebstore.google.com/detail/abc')).toBe(true)
  })
  it('flags undefined urls', () => {
    expect(isRestrictedUrl(undefined)).toBe(true)
  })
  it('flags local file pages', () => {
    expect(isRestrictedUrl('file:///Users/me/report.pdf')).toBe(true)
  })
  it('allows normal http(s) pages', () => {
    expect(isRestrictedUrl('https://example.com/article')).toBe(false)
  })
})
