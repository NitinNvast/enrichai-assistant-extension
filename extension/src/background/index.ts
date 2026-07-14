import { ApiClientError, requestExtraction } from '../lib/api'
import { writeState } from '../lib/state'
import type { ExtractCommand, ExtractResult, StateUpdateMessage } from '../types'

// Open the side panel when the toolbar icon is clicked.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})

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
