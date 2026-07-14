import { SELECTORS } from '../constants'
import { parseGuidelines } from '../lib/guidelineParser'
import { parseProduct } from '../lib/productParser'
import { isTargetPage } from '../lib/site'
import { parseUrlContext } from '../lib/urlContext'
import { watchDom } from '../lib/observer'
import type { DetectionState, StateUpdateMessage } from '../types'

const win = window as unknown as { __enrichAiLoaded?: boolean }

if (!win.__enrichAiLoaded) {
  win.__enrichAiLoaded = true
  start()
}

function computeState(): DetectionState {
  const url = location.href
  if (!isTargetPage(url)) {
    return { supportedPage: false, context: null, guidelines: null, product: null }
  }
  const context = parseUrlContext(url)
  const guidelines = context.attributeName ? parseGuidelines(document, context.attributeName) : null
  const modal = document.querySelector(SELECTORS.modal)
  const product = modal ? parseProduct(modal) : null
  return { supportedPage: true, context, guidelines, product }
}

let lastSerialized = ''
function report(): void {
  const state = computeState()
  const serialized = JSON.stringify(state)
  if (serialized === lastSerialized) return
  lastSerialized = serialized
  const msg: StateUpdateMessage = { type: 'STATE_UPDATE', state }
  chrome.runtime.sendMessage(msg).catch(() => {})
}

function start(): void {
  report()
  watchDom(document.documentElement, report, 250)
  patchHistory(report)
  window.addEventListener('popstate', report)
}

// EnrichAI is a React SPA; route changes don't reload the page. Re-detect on
// client-side navigation by hooking the History API + popstate.
function patchHistory(cb: () => void): void {
  const h = history as History & { __enrichAiPatched?: boolean }
  if (h.__enrichAiPatched) return
  h.__enrichAiPatched = true
  ;(['pushState', 'replaceState'] as const).forEach((method) => {
    const original = history[method].bind(history)
    history[method] = function patched(this: History, ...args: unknown[]) {
      const result = (original as (...a: unknown[]) => unknown)(...args)
      cb()
      return result
    } as History[typeof method]
  })
}
