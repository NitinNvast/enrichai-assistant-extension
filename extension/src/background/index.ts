import contentScriptPath from '../content/index?script'
import { ApiClientError, requestSummary } from '../lib/api'
import { isRestrictedUrl } from '../lib/restricted'
import type { ExtractResult, SummarizeCommand, SummarizeResult } from '../types'

const ACTIVE_TAB_KEY = 'activeTabId'

// An earlier build called setPanelBehavior({ openPanelOnActionClick: true }).
// Chrome persists that setting per-extension independent of source code, so
// it survives this update and would silently swallow our onClicked listener
// below (open-on-click and onClicked are mutually exclusive). Force it back
// off so the click always reaches our handler.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {})

// Clicking the toolbar icon is the user gesture that grants `activeTab` for
// that specific tab. Capture the tab id here (persisted in session storage so
// it survives service-worker restarts) instead of later querying "the active
// tab" — the side panel stays open across tab switches, but the activeTab
// grant does not follow it, so re-querying can land on a tab we were never
// granted access to.
//
// chrome.sidePanel.open() must be called synchronously, before any `await`,
// or Chrome silently drops the call because the user-gesture context from
// the click is gone by the time the microtask queue drains (crbug 344767733).
// So it goes first here, and the storage write — which has no gesture
// requirement — comes after.
chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return
  const tabId = tab.id
  chrome.sidePanel.open({ tabId }).catch(() => {})
  chrome.storage.session.set({ [ACTIVE_TAB_KEY]: tabId }).catch(() => {})
})

chrome.runtime.onMessage.addListener((msg: SummarizeCommand, _sender, sendResponse) => {
  if (msg?.type !== 'SUMMARIZE_ACTIVE_TAB') return
  handleSummarize(msg).then(sendResponse)
  return true // async response
})

async function handleSummarize(msg: SummarizeCommand): Promise<SummarizeResult> {
  const stored = await chrome.storage.session.get(ACTIVE_TAB_KEY)
  const tabId = stored[ACTIVE_TAB_KEY] as number | undefined

  let tab: chrome.tabs.Tab | undefined
  if (tabId !== undefined) {
    try {
      tab = await chrome.tabs.get(tabId)
    } catch {
      tab = undefined // tab was closed since the icon was clicked
    }
  }

  if (!tab?.id || isRestrictedUrl(tab.url)) {
    return { ok: false, error: { code: 'restricted_page', message: "This page can't be summarized." } }
  }

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [contentScriptPath] })
  } catch {
    return { ok: false, error: { code: 'injection_failed', message: "Couldn't read this page." } }
  }

  let extracted: ExtractResult
  try {
    extracted = (await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT' })) as ExtractResult
  } catch {
    return { ok: false, error: { code: 'extract_failed', message: "Couldn't read this page." } }
  }
  if (!extracted.ok) return { ok: false, error: extracted.error }

  const { title, url, content, truncated } = extracted.data
  if (!content.trim()) {
    return { ok: false, error: { code: 'empty_content', message: 'No readable content found on this page.' } }
  }

  try {
    const data = await requestSummary({ url, title, content, options: msg.options })
    return {
      ok: true,
      data: { ...data, truncated: data.truncated || truncated },
      page: { title, url },
    }
  } catch (err) {
    const e = err as ApiClientError
    return { ok: false, error: { code: e.code ?? 'unknown', message: e.message } }
  }
}
