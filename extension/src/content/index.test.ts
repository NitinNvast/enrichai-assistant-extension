// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

// Re-import the content module fresh: reset the module registry and clear the
// one-shot injection guard so its bootstrap (`start()`) runs again.
function freshImport(): Promise<unknown> {
  vi.resetModules()
  delete (window as unknown as { __enrichAiLoaded?: boolean }).__enrichAiLoaded
  return import('./index')
}

describe('content script bootstrap', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('initializes on import without a temporal-dead-zone error', async () => {
    vi.stubGlobal('chrome', {
      runtime: { id: 'abc', sendMessage: vi.fn(() => Promise.resolve()) },
    })
    await expect(freshImport()).resolves.toBeDefined()
  })

  it('does not throw when sendMessage fails synchronously (extension context invalidated)', async () => {
    // Once the extension is reloaded/updated, the orphaned content script's
    // chrome.runtime.sendMessage throws synchronously — .catch() can't help.
    vi.stubGlobal('chrome', {
      runtime: {
        id: 'abc',
        sendMessage: vi.fn(() => {
          throw new Error('Extension context invalidated.')
        }),
      },
    })
    await expect(freshImport()).resolves.toBeDefined()
  })
})
