import { parseGuidelines } from '../lib/guidelineParser'
import { parseProduct } from '../lib/productParser'
import { isTargetPage } from '../lib/site'
import { parseUrlContext } from '../lib/urlContext'
import { watchDom } from '../lib/observer'
import type { DetectionState, StateUpdateMessage } from '../types'

function computeState(): DetectionState {
  const url = location.href
  if (!isTargetPage(url)) {
    return { supportedPage: false, context: null, guidelines: null, product: null }
  }
  const context = parseUrlContext(url)
  const guidelines = context.attributeName ? parseGuidelines(document, context.attributeName) : null
  const product = parseProduct(document)
  return { supportedPage: true, context, guidelines, product }
}

let lastSerialized = ''
let alive = true
let disconnectObserver: (() => void) | null = null

function report(): void {
  if (!alive) return
  const state = computeState()
  const serialized = JSON.stringify(state)
  if (serialized === lastSerialized) return
  lastSerialized = serialized
  const msg: StateUpdateMessage = { type: 'STATE_UPDATE', state }
  try {
    // Once the extension is reloaded/updated, this injected script is orphaned:
    // chrome.runtime.id goes undefined and sendMessage throws SYNCHRONOUSLY
    // ("Extension context invalidated"), so .catch() alone can't guard it. Tear
    // down instead of letting the dead script keep throwing on every mutation.
    if (!chrome.runtime?.id) throw new Error('extension context invalidated')
    chrome.runtime.sendMessage(msg).catch(() => {})
  } catch {
    teardown()
  }
}

function teardown(): void {
  if (!alive) return
  alive = false
  disconnectObserver?.()
  disconnectObserver = null
  window.removeEventListener('popstate', report)
}

function start(): void {
  report()
  if (!alive) return // context was already dead on the first report
  disconnectObserver = watchDom(document.documentElement, report, 250)
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

// Bootstrap LAST: `start()` transitively reads module-level state (e.g.
// `lastSerialized`), so it must run only after every declaration above has been
// initialized. Calling it earlier throws a temporal-dead-zone ReferenceError at
// injection time. Guarded so the SPA's re-injections don't double-initialize.
const win = window as unknown as { __enrichAiLoaded?: boolean }
if (!win.__enrichAiLoaded) {
  win.__enrichAiLoaded = true
  start()
}
