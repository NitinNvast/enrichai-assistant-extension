import { afterEach, describe, expect, it, vi } from 'vitest'
import { syncPanel } from './panel'

const TARGET_URL = 'https://cc.gbiqa.groupbycloud.com/enrich/enrichai/project/1'
const OTHER_URL = 'https://mail.google.com/'

function stubSidePanel(setOptions = vi.fn(() => Promise.resolve())) {
  vi.stubGlobal('chrome', { sidePanel: { setOptions } })
  return setOptions
}

describe('syncPanel', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('enables the panel on the enrichai page', async () => {
    const setOptions = stubSidePanel()
    await syncPanel(7, TARGET_URL)
    expect(setOptions).toHaveBeenCalledWith({
      tabId: 7,
      path: 'src/sidepanel/index.html',
      enabled: true,
    })
  })

  it('enables the panel on any other page of the target host', async () => {
    const setOptions = stubSidePanel()
    await syncPanel(7, 'https://cc.gbiqa.groupbycloud.com/dashboard')
    expect(setOptions).toHaveBeenCalledWith({
      tabId: 7,
      path: 'src/sidepanel/index.html',
      enabled: true,
    })
  })

  it('disables the panel on an unrelated site', async () => {
    const setOptions = stubSidePanel()
    await syncPanel(7, OTHER_URL)
    expect(setOptions).toHaveBeenCalledWith({ tabId: 7, enabled: false })
  })

  it('disables the panel when the url is unknown', async () => {
    const setOptions = stubSidePanel()
    await syncPanel(7, undefined)
    expect(setOptions).toHaveBeenCalledWith({ tabId: 7, enabled: false })
  })

  it('swallows errors when the tab no longer exists', async () => {
    stubSidePanel(vi.fn(() => Promise.reject(new Error('No tab with id: 7.'))))
    await expect(syncPanel(7, TARGET_URL)).resolves.toBeUndefined()
  })
})
