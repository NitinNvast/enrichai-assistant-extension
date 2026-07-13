import { describe, expect, it } from 'vitest'
import { prependCapped, type HistoryEntry } from './storage'

function entry(id: string): HistoryEntry {
  return { id, url: 'u', title: 't', summary: 's', model: 'm', createdAt: 0 }
}

describe('prependCapped', () => {
  it('puts the newest entry first', () => {
    const result = prependCapped(entry('b'), [entry('a')])
    expect(result.map((e) => e.id)).toEqual(['b', 'a'])
  })
  it('caps the list at max entries', () => {
    const existing = [entry('1'), entry('2'), entry('3')]
    const result = prependCapped(entry('new'), existing, 3)
    expect(result.map((e) => e.id)).toEqual(['new', '1', '2'])
  })
})
