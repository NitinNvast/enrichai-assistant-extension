import { useState } from 'react'
import type { SummarizeResult, SummaryLength } from '../types'

type Status = 'idle' | 'loading' | 'done' | 'error'

export default function App() {
  const [status, setStatus] = useState<Status>('idle')
  const [summary, setSummary] = useState('')
  const [error, setError] = useState('')
  const [truncated, setTruncated] = useState(false)
  const [length, setLength] = useState<SummaryLength>('medium')

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
      } else {
        setError(result.error.message)
        setStatus('error')
      }
    } catch {
      setError('Something went wrong. Try again.')
      setStatus('error')
    }
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
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {truncated && (
            <p className="text-xs text-amber-600">Note: only part of the page was summarized.</p>
          )}
          <div className="flex-1 overflow-y-auto whitespace-pre-wrap rounded border p-3">
            {summary}
          </div>
        </div>
      )}
    </div>
  )
}
