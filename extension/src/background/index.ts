import { ApiClientError, requestExtraction } from '../lib/api'
import { syncPanel } from '../lib/panel'
import { reloadTargetHostTabs } from '../lib/reinject'
import { isTargetHost } from '../lib/site'
import { writeState } from '../lib/state'
import type { ExtractCommand, ExtractResult, StateUpdateMessage } from '../types'

// The panel must exist ONLY on the EnrichAI host. `openPanelOnActionClick` opens a
// GLOBAL panel — a window-level surface that stays visible on every tab and ignores
// per-tab disabling — which is why it used to linger after navigating away. Instead
// keep the panel disabled by default and open it explicitly, tab-scoped, from the
// toolbar click (see the action.onClicked handler below), so it belongs to that tab
// alone and closes as soon as a non-target tab (which syncPanel disables) is shown.
chrome.sidePanel.setOptions({ enabled: false }).catch(() => {})
// Explicitly opt OUT of the global open-on-click behavior. It persists across
// updates, so a build that previously enabled it would otherwise keep opening the
// global panel and suppress the action.onClicked handler below.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {})

// Toolbar icon: open the tab-scoped panel, but only on the target host. open() must
// run synchronously inside the user-gesture, so it is not awaited. syncPanel has
// already enabled this tab (on activation/load), which open() requires.
chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined || !isTargetHost(tab.url)) return
  chrome.sidePanel.open({ tabId: tab.id }).catch(() => {})
})

// After the extension installs, updates, or reloads (e.g. a rebuild during
// development), the content script already injected into open EnrichAI tabs is
// orphaned and Chrome will not replace it until the page reloads. Reload those tabs
// so a fresh content script is injected automatically — no manual hard reload.
chrome.runtime.onInstalled.addListener(() => {
  reloadTargetHostTabs().catch(() => {})
})

// Keep the side panel scoped to the EnrichAI app: enable it on target pages and
// disable it everywhere else. Disabling for the active tab closes the panel, so it
// vanishes as soon as the user navigates to an unrelated site or switches tabs
// instead of lingering on other tabs.
//
// onUpdated covers full loads AND same-tab SPA route changes (history.pushState
// fires it with changeInfo.url); onActivated covers tab switches, including to
// tabs that loaded before this worker started. Both feed the same syncPanel.
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.url === undefined && info.status === undefined) return
  syncPanel(tabId, tab.url).catch(() => {})
})

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs
    .get(tabId)
    .then((tab) => syncPanel(tabId, tab.url))
    .catch(() => {})
})

// Sync the tab that is already active when the worker starts (install, update, or
// wake-up), since no tab event fires for it.
chrome.tabs
  .query({ active: true, currentWindow: true })
  .then(([tab]) => {
    if (tab?.id !== undefined) return syncPanel(tab.id, tab.url)
  })
  .catch(() => {})

// Content script -> persist detection state for the sending tab.
chrome.runtime.onMessage.addListener((msg: StateUpdateMessage, sender) => {
  if (msg?.type !== 'STATE_UPDATE') return
  const tabId = sender.tab?.id
  if (tabId === undefined) return
  writeState(tabId, msg.state).catch(() => {})
})

// Side panel -> run the LLM extraction (the ONLY network call in the system).
chrome.runtime.onMessage.addListener((msg: ExtractCommand, _sender, sendResponse) => {
  if (msg?.type !== 'EXTRACT_ATTRIBUTE') return
  handleExtract(msg).then(sendResponse)
  return true // async response
})

async function handleExtract(msg: ExtractCommand): Promise<ExtractResult> {
  try {
    const data = await requestExtraction(msg.payload)
    return { ok: true, data }
  } catch (err) {
    const e = err as ApiClientError
    return { ok: false, error: { code: e.code ?? 'unknown', message: e.message } }
  }
}
