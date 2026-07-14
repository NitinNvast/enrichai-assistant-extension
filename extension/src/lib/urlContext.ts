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
    attributeName: rawAttr ? rawAttr.replace(ATTR_TYPE_PREFIX, '').trim() : null,
  }
}
