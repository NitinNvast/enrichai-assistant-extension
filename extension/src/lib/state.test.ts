import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readState, writeState } from './state'
import type { DetectionState } from '../types'

const store: Record<string, unknown> = {}

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k]
  ;(globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      session: {
        set: vi.fn(async (obj: Record<string, unknown>) => Object.assign(store, obj)),
        get: vi.fn(async (key: string) => ({ [key]: store[key] })),
      },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  }
})

const SAMPLE: DetectionState = { supportedPage: true, context: null, guidelines: null, product: null }

describe('detection state storage', () => {
  it('writes and reads per-tab state', async () => {
    await writeState(42, SAMPLE)
    expect(store['detectionState:42']).toEqual(SAMPLE)
    expect(await readState(42)).toEqual(SAMPLE)
  })
  it('returns null for an unknown tab', async () => {
    expect(await readState(999)).toBeNull()
  })
})
