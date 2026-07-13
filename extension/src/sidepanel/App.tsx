import { useEffect, useState } from 'react'
import type { SummarizeResult, SummaryLength } from '../types'
import {
  addHistory,
  clearHistory,
  loadHistory,
  type HistoryEntry,
} from '../lib/storage'

type Status = 'idle' | 'loading' | 'done' | 'error'

function makeId(url: string): string {
  return `${url}::${performance.now()}`
}

export default function App() {
  const [status, setStatus] = useState<Status>('idle')
  const [summary, setSummary] = useState('')
  const [error, setError] = useState('')
  const [truncated, setTruncated] = useState(false)
  const [length, setLength] = useState<SummaryLength>('medium')
  const [history, setHistory] = useState<HistoryEntry[]>([])

  useEffect(() => {
    loadHistory().then(setHistory)
  }, [])

  async function onSummarize() {
    setStatus('loading')
    setError('')
    setSummary('')
    setTruncated(false)

    try {
      const result = (await chrome.runtime.sendMessage({
        type: 'SUMMARIZE_ACTIVE_TAB',
        options: { length },
      })) as SummarizeResult

      if (result.ok) {
        setSummary(result.data.summary)
        setTruncated(result.data.truncated)
        setStatus('done')
        const entry: HistoryEntry = {
          id: makeId(result.page.url),
          url: result.page.url,
          title: result.page.title,
          summary: result.data.summary,
          model: result.data.model,
          createdAt: Date.now(),
        }
        setHistory(await addHistory(entry))
      } else {
        setError(result.error.message)
        setStatus('error')
      }
    } catch {
      setError('Something went wrong. Try again.')
      setStatus('error')
    }
  }

  async function onClearHistory() {
    await clearHistory()
    setHistory([])
  }

  return (
    <div className="flex h-screen flex-col gap-3 p-4 text-sm">
      <h1 className="text-base font-semibold">AI Page Summarizer</h1>

      <div className="flex items-center gap-2">
        <select
          value={length}
          onChange={(e) => setLength(e.target.value as SummaryLength)}
          className="rounded border px-2 py-1"
          disabled={status === 'loading'}
        >
          <option value="short">Short</option>
          <option value="medium">Medium</option>
          <option value="long">Long</option>
        </select>
        <button
          onClick={onSummarize}
          disabled={status === 'loading'}
          className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {status === 'loading' ? 'Summarizing…' : 'Summarize'}
        </button>
      </div>

      {status === 'idle' && <p className="text-gray-500">Click Summarize to get started.</p>}
      {status === 'error' && <p className="rounded bg-red-50 p-2 text-red-700">{error}</p>}
      {status === 'done' && (
        <div className="flex flex-col gap-2">
          {truncated && (
            <p className="text-xs text-amber-600">Note: only part of the page was summarized.</p>
          )}
          <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded border p-3">
            {summary}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Recent</h2>
            <button onClick={onClearHistory} className="text-xs text-gray-500 hover:underline">
              Clear
            </button>
          </div>
          <ul className="flex-1 overflow-y-auto">
            {history.map((h) => (
              <li key={h.id} className="border-b py-2">
                <p className="truncate font-medium" title={h.title}>
                  {h.title || h.url}
                </p>
                <p className="line-clamp-3 text-gray-600">{h.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
