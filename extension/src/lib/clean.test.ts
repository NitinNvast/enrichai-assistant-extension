import { describe, expect, it } from 'vitest'
import { cleanText, truncate } from './clean'

describe('cleanText', () => {
  it('collapses runs of spaces and tabs', () => {
    expect(cleanText('a    b\t\tc')).toBe('a b c')
  })
  it('trims each line and drops excess blank lines', () => {
    expect(cleanText('  hi  \n\n\n\n  there  ')).toBe('hi\n\nthere')
  })
})

describe('truncate', () => {
  it('leaves short text unchanged', () => {
    expect(truncate('hello', 10)).toEqual({ text: 'hello', truncated: false })
  })
  it('cuts long text and flags truncation', () => {
    expect(truncate('abcdef', 3)).toEqual({ text: 'abc', truncated: true })
  })
})
