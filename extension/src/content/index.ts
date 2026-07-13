import type { ExtractCommand, ExtractResult } from '../types'
import { extractContent } from '../lib/extract'

// Guard: executeScript may inject this file more than once per page.
const win = window as unknown as { __aiSummarizerLoaded?: boolean }

if (!win.__aiSummarizerLoaded) {
  win.__aiSummarizerLoaded = true

  chrome.runtime.onMessage.addListener((msg: ExtractCommand, _sender, sendResponse) => {
    if (msg?.type !== 'EXTRACT') return
    try {
      const data = extractContent()
      const result: ExtractResult = { ok: true, data }
      sendResponse(result)
    } catch (err) {
      const result: ExtractResult = {
        ok: false,
        error: { code: 'extract_error', message: (err as Error).message },
      }
      sendResponse(result)
    }
    return true // keep the message channel open for the async response
  })
}
