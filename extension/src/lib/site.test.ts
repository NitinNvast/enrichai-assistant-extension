import { describe, expect, it } from 'vitest'
import { isTargetHost, isTargetPage } from './site'

describe('isTargetPage', () => {
  it('allows the enrichai path on the target host', () => {
    expect(isTargetPage('https://cc.gbiqa.groupbycloud.com/enrich/enrichai/hlqa?projectId=x')).toBe(true)
  })
  it('rejects a different path on the target host', () => {
    expect(isTargetPage('https://cc.gbiqa.groupbycloud.com/dashboard')).toBe(false)
  })
  it('rejects a different host', () => {
    expect(isTargetPage('https://example.com/enrich/enrichai/hlqa')).toBe(false)
  })
  it('rejects undefined and malformed urls', () => {
    expect(isTargetPage(undefined)).toBe(false)
    expect(isTargetPage('not a url')).toBe(false)
  })
})

describe('isTargetHost', () => {
  it('allows any path on the target host', () => {
    expect(isTargetHost('https://cc.gbiqa.groupbycloud.com/enrich/enrichai/hlqa')).toBe(true)
    expect(isTargetHost('https://cc.gbiqa.groupbycloud.com/dashboard')).toBe(true)
    expect(isTargetHost('https://cc.gbiqa.groupbycloud.com/')).toBe(true)
  })
  it('rejects a different host', () => {
    expect(isTargetHost('https://example.com/enrich/enrichai/hlqa')).toBe(false)
  })
  it('rejects undefined and malformed urls', () => {
    expect(isTargetHost(undefined)).toBe(false)
    expect(isTargetHost('not a url')).toBe(false)
  })
})
