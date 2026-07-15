// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

// The content script runs its bootstrap at module-eval time. Regression guard:
// the bootstrap must run AFTER every module-level declaration it transitively
// touches (notably `lastSerialized`), or it throws a temporal-dead-zone
// ReferenceError on injection ("Cannot access 'lastSerialized' before
// initialization") and no state is ever reported.
describe('content script bootstrap', () => {
  it('initializes on import without a temporal-dead-zone error', async () => {
    vi.stubGlobal('chrome', {
      runtime: { sendMessage: vi.fn(() => Promise.resolve()) },
    })
    await expect(import('./index')).resolves.toBeDefined()
  })
})
