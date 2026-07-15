import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readState, writeState, subscribeState } from './state'
import type { DetectionState } from '../types'

const store: Record<string, unknown> = {}
const listeners: Array<(changes: Record<string, chrome.storage.StorageChange>, area: string) => void> = []

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k]
  listeners.length = 0
  ;(globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      session: {
        set: vi.fn(async (obj: Record<string, unknown>) => Object.assign(store, obj)),
        get: vi.fn(async (key: string) => ({ [key]: store[key] })),
      },
      onChanged: {
        addListener: vi.fn((listener) => listeners.push(listener)),
        removeListener: vi.fn((listener) => {
          const idx = listeners.indexOf(listener)
          if (idx >= 0) listeners.splice(idx, 1)
        }),
      },
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

  it('registers a listener via chrome.storage.onChanged.addListener', () => {
    const cb = vi.fn()
    subscribeState(42, cb)
    const mock = chrome.storage.onChanged.addListener as ReturnType<typeof vi.fn>
    expect(mock).toHaveBeenCalledTimes(1)
    expect(listeners).toHaveLength(1)
  })

  it('calls callback when storage changes for this tab in session area', () => {
    const cb = vi.fn()
    subscribeState(42, cb)
    const listener = listeners[0]

    const newState: DetectionState = { ...SAMPLE, supportedPage: false }
    listener({ 'detectionState:42': { newValue: newState } }, 'session')

    expect(cb).toHaveBeenCalledOnce()
    expect(cb).toHaveBeenCalledWith(newState)
  })

  it('does not call callback when change is for a different tab', () => {
    const cb = vi.fn()
    subscribeState(42, cb)
    const listener = listeners[0]

    listener({ 'detectionState:99': { newValue: SAMPLE } }, 'session')

    expect(cb).not.toHaveBeenCalled()
  })

  it('does not call callback when change is in a different storage area', () => {
    const cb = vi.fn()
    subscribeState(42, cb)
    const listener = listeners[0]

    listener({ 'detectionState:42': { newValue: SAMPLE } }, 'local')

    expect(cb).not.toHaveBeenCalled()
  })

  it('unsubscribe removes listener via chrome.storage.onChanged.removeListener', () => {
    const cb = vi.fn()
    const unsubscribe = subscribeState(42, cb)
    const listener = listeners[0]

    const removeMock = chrome.storage.onChanged.removeListener as ReturnType<typeof vi.fn>
    unsubscribe()

    expect(removeMock).toHaveBeenCalledOnce()
    expect(removeMock).toHaveBeenCalledWith(listener)
    expect(listeners).toHaveLength(0)
  })

  it('callback receives null when newValue is undefined', () => {
    const cb = vi.fn()
    subscribeState(42, cb)
    const listener = listeners[0]

    listener({ 'detectionState:42': { newValue: undefined } }, 'session')

    expect(cb).toHaveBeenCalledOnce()
    expect(cb).toHaveBeenCalledWith(null)
  })
})
