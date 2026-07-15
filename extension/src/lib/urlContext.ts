import { ATTR_TYPE_PREFIX } from '../constants'
import type { UrlContext } from '../types'

export function parseUrlContext(url: string): UrlContext {
  let params: URLSearchParams
  try {
    params = new URL(url).searchParams
  } catch {
    params = new URLSearchParams()
  }
  const rawAttr = params.get('attributeName')
  return {
    projectId: params.get('projectId'),
    catalogId: params.get('catalogId'),
    terminalNodeId: params.get('terminalNodeId'),
    attributeName: rawAttr ? decodeMaybe(rawAttr).replace(ATTR_TYPE_PREFIX, '').trim() : null,
  }
}

// URLSearchParams already percent-decodes once. The EnrichAI SPA sometimes
// re-encodes an already-encoded attributeName, so a single decode still leaves
// escapes like `%20`/`%5B` behind. Decode a second time only when the value
// still looks percent-encoded, guarded so a stray literal `%` can't throw.
function decodeMaybe(value: string): string {
  if (!/%[0-9A-Fa-f]{2}/.test(value)) return value
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
