import type { DetectionState } from '../types'

const PREFIX = 'detectionState:'
const keyFor = (tabId: number) => `${PREFIX}${tabId}`

export async function writeState(tabId: number, state: DetectionState): Promise<void> {
  await chrome.storage.session.set({ [keyFor(tabId)]: state })
}

export async function readState(tabId: number): Promise<DetectionState | null> {
  const key = keyFor(tabId)
  const result = await chrome.storage.session.get(key)
  return (result[key] as DetectionState) ?? null
}

export function subscribeState(tabId: number, cb: (state: DetectionState | null) => void): () => void {
  const key = keyFor(tabId)
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ): void => {
    if (area !== 'session' || !(key in changes)) return
    cb((changes[key].newValue as DetectionState) ?? null)
  }
  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}
