import { describe, expect, it } from 'vitest'
import { TARGET_HOST, TARGET_PATH_PREFIX, ATTR_TYPE_PREFIX } from './constants'

describe('constants', () => {
  it('targets the EnrichAI host', () => {
    expect(TARGET_HOST).toBe('cc.gbiqa.groupbycloud.com')
  })
  it('targets the enrichai path prefix', () => {
    expect(TARGET_PATH_PREFIX).toBe('/enrich/enrichai/')
  })
  it('strips a [T] type prefix', () => {
    expect('[T]Fit - Shoe Width'.replace(ATTR_TYPE_PREFIX, '')).toBe('Fit - Shoe Width')
  })
})
