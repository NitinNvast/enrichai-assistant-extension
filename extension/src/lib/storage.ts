export interface HistoryEntry {
  id: string
  url: string
  title: string
  summary: string
  model: string
  createdAt: number
}

const KEY = 'summaries'
export const MAX_ENTRIES = 20

export function prependCapped(
  entry: HistoryEntry,
  existing: HistoryEntry[],
  max: number = MAX_ENTRIES,
): HistoryEntry[] {
  return [entry, ...existing].slice(0, max)
}

export async function loadHistory(): Promise<HistoryEntry[]> {
  const result = await chrome.storage.local.get(KEY)
  return (result[KEY] as HistoryEntry[]) ?? []
}

export async function addHistory(entry: HistoryEntry): Promise<HistoryEntry[]> {
  const existing = await loadHistory()
  const next = prependCapped(entry, existing)
  await chrome.storage.local.set({ [KEY]: next })
  return next
}

export async function clearHistory(): Promise<void> {
  await chrome.storage.local.remove(KEY)
}
