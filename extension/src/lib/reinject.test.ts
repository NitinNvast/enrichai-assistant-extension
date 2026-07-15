import { afterEach, describe, expect, it, vi } from 'vitest'
import { reloadTargetHostTabs } from './reinject'

type Tab = { id: number | undefined }

function stubTabs(tabs: Tab[], reload = vi.fn(() => Promise.resolve())) {
  const query = vi.fn(() => Promise.resolve(tabs))
  vi.stubGlobal('chrome', { tabs: { query, reload } })
  return { query, reload }
}

describe('reloadTargetHostTabs', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('queries only tabs on the target host', async () => {
    const { query } = stubTabs([])
    await reloadTargetHostTabs()
    expect(query).toHaveBeenCalledWith({ url: 'https://cc.gbiqa.groupbycloud.com/*' })
  })

  it('reloads every matching tab', async () => {
    const { reload } = stubTabs([{ id: 1 }, { id: 2 }])
    await reloadTargetHostTabs()
    expect(reload).toHaveBeenCalledWith(1)
    expect(reload).toHaveBeenCalledWith(2)
  })

  it('skips tabs without an id', async () => {
    const { reload } = stubTabs([{ id: undefined }, { id: 3 }])
    await reloadTargetHostTabs()
    expect(reload).toHaveBeenCalledTimes(1)
    expect(reload).toHaveBeenCalledWith(3)
  })

  it('ignores reload failures', async () => {
    stubTabs([{ id: 1 }], vi.fn(() => Promise.reject(new Error('cannot reload'))))
    await expect(reloadTargetHostTabs()).resolves.toBeUndefined()
  })
})
