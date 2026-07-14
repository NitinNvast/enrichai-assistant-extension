import { useEffect, useState } from 'react'
import { readState, subscribeState } from '../lib/state'
import type { DetectionState, ExtractCommand, ExtractRequest, ExtractResult } from '../types'

type Phase = 'idle' | 'loading' | 'done' | 'error'

async function getActiveTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab?.id
}

function buildPayload(state: DetectionState): ExtractRequest | null {
  const { context, guidelines, product } = state
  if (!context?.attributeName || !guidelines || !product) return null
  return {
    attributeName: context.attributeName,
    guidelines: { instructions: guidelines.instructions, allowedValues: guidelines.allowedValues },
    product: { name: product.productName, description: product.description, specifications: product.specifications },
    context: { projectId: context.projectId, catalogId: context.catalogId, terminalNodeId: context.terminalNodeId },
  }
}

export default function App() {
  const [state, setState] = useState<DetectionState | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<{ attribute: string; classification: string } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let unsub = () => {}
    getActiveTabId().then((tabId) => {
      if (tabId === undefined) return
      readState(tabId).then(setState)
      unsub = subscribeState(tabId, setState)
    })
    return () => unsub()
  }, [])

  const payload = state ? buildPayload(state) : null
  const canExtract = payload !== null && phase !== 'loading'

  async function onExtract() {
    if (!payload) return
    setPhase('loading')
    setError('')
    setResult(null)
    const msg: ExtractCommand = { type: 'EXTRACT_ATTRIBUTE', payload }
    try {
      const res = (await chrome.runtime.sendMessage(msg)) as ExtractResult
      if (res.ok) {
        setResult({ attribute: res.data.attribute, classification: res.data.classification })
        setPhase('done')
      } else {
        setError(res.error.message)
        setPhase('error')
      }
    } catch {
      setError('Something went wrong. Try again.')
      setPhase('error')
    }
  }

  return (
    <div className="flex h-screen flex-col gap-3 p-4 text-sm">
      <h1 className="text-base font-semibold">EnrichAI Assistant</h1>

      {!state?.supportedPage && (
        <p className="text-gray-500">Waiting for product page…<br />No product detected.</p>
      )}

      {state?.supportedPage && state.guidelines && (
        <section className="rounded border p-3">
          <p className="font-medium text-green-700">Guidelines Detected ✓</p>
          <p className="mt-1">Attribute: <span className="font-medium">{state.guidelines.attributeName}</span></p>
          <ul className="mt-1 list-inside list-disc text-gray-700">
            {state.guidelines.allowedValues.map((v) => <li key={v}>{v}</li>)}
          </ul>
        </section>
      )}

      {state?.supportedPage && state.product && (
        <section className="rounded border p-3">
          <p className="font-medium text-green-700">Product Detected ✓</p>
          <p className="mt-1 font-medium">{state.product.productName}</p>
          <p className="text-gray-600">{state.product.description}</p>
          {state.context?.attributeName && (
            <p className="mt-2">Target Attribute: <span className="font-medium">{state.context.attributeName}</span></p>
          )}
          <button
            onClick={onExtract}
            disabled={!canExtract}
            className="mt-2 rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {phase === 'loading' ? 'Extracting…' : 'Extract Attribute'}
          </button>
        </section>
      )}

      {phase === 'error' && <p className="rounded bg-red-50 p-2 text-red-700">{error}</p>}

      {phase === 'done' && result && (
        <section className="rounded border p-3">
          <p className="font-medium">Attribute Classification</p>
          <p className="mt-1 text-gray-700">{result.attribute}</p>
          <p className="mt-1 text-lg font-semibold">{result.classification || 'No confident value'}</p>
        </section>
      )}
    </div>
  )
}
