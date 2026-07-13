import contentScriptPath from '../content/index?script'
import { ApiClientError, requestSummary } from '../lib/api'
import { isRestrictedUrl } from '../lib/restricted'
import type { ExtractResult, SummarizeCommand, SummarizeResult } from '../types'

// Open the side panel when the toolbar icon is clicked.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})
})

chrome.runtime.onMessage.addListener((msg: SummarizeCommand, _sender, sendResponse) => {
  if (msg?.type !== 'SUMMARIZE_ACTIVE_TAB') return
  handleSummarize(msg).then(sendResponse)
  return true // async response
})

async function handleSummarize(msg: SummarizeCommand): Promise<SummarizeResult> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
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
