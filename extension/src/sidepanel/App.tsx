import { useEffect, useRef, useState } from 'react'
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
    guidelines: {
      instructions: guidelines.instructions,
      allowedValues: guidelines.allowedValues.map((v) => v.value),
    },
    product: { name: product.productName, description: product.description, specifications: product.specifications },
    context: { projectId: context.projectId, catalogId: context.catalogId, terminalNodeId: context.terminalNodeId },
  }
}

function identityOf(state: DetectionState | null): string {
  return `${state?.product?.productName ?? ''}::${state?.context?.attributeName ?? ''}`
}

export default function App() {
  const [state, setState] = useState<DetectionState | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<{ attribute: string; classification: string } | null>(null)
  const [error, setError] = useState('')
  // Identity (product + attribute) that the current `result`/`error` belongs to. Cleared
  // whenever a new DetectionState arrives for a different product/attribute so stale
  // results don't linger across product changes, modal reopen, or navigation.
  const resultIdentityRef = useRef<string | null>(null)
  // Always mirrors the latest `identity`, independent of `resultIdentityRef` above. Used
  // only by in-flight `onExtract` requests to detect, once their response arrives, whether
  // the identity they were sent for is still the one currently displayed (e.g. the user
  // may have switched tabs while the request was in flight). Do not conflate this with
  // `resultIdentityRef`, which tracks what identity the *rendered result* belongs to.
  const currentIdentityRef = useRef<string>('')

  const identity = identityOf(state)

  useEffect(() => {
    currentIdentityRef.current = identity
  }, [identity])

  useEffect(() => {
    if (resultIdentityRef.current !== null && resultIdentityRef.current !== identity) {
      setPhase('idle')
      setResult(null)
      setError('')
      resultIdentityRef.current = null
    }
  }, [identity])

  useEffect(() => {
    let cancelled = false
    // Monotonic counter identifying the "current" subscription attempt. Guards against the
    // initial-mount subscribe chain and a later `onActivated` subscribe chain both resolving
    // out of order and writing to `unsub`. Each chain freezes its own `myGeneration` snapshot
    // SYNCHRONOUSLY — before it starts its `getActiveTabId()` call, i.e. before the async gap
    // in which a newer chain could start and bump `generation`. When the async gap resolves,
    // the callback compares its frozen `myGeneration` against the (possibly since-bumped) live
    // `generation`: if they differ, this chain is stale and bails out (or, inside
    // subscribeToTab, tears down its own just-created listener) instead of clobbering — and
    // thereby orphaning — a newer chain's `unsub`. Capturing the snapshot any later (e.g. only
    // once the async work has already resolved) would make the comparison a tautology, since
    // there is no further async gap between the capture and the check.
    let generation = 0
    let unsub = () => {}

    function subscribeToTab(tabId: number, myGeneration: number) {
      readState(tabId)
        .then((s) => {
          if (!cancelled && myGeneration === generation) setState(s)
        })
        .catch(() => {})

      const u = subscribeState(tabId, setState)
      if (cancelled || myGeneration !== generation) {
        u()
      } else {
        unsub = u
      }
    }

    function onActivated() {
      generation += 1
      const myGeneration = generation
      getActiveTabId()
        .then((tabId) => {
          if (cancelled || tabId === undefined || myGeneration !== generation) return
          unsub()
          unsub = () => {}
          setState(null)
          subscribeToTab(tabId, myGeneration)
        })
        .catch(() => {})
    }

    const initialGeneration = generation
    getActiveTabId()
      .then((tabId) => {
        if (cancelled || tabId === undefined) return
        subscribeToTab(tabId, initialGeneration)
      })
      .catch(() => {})

    chrome.tabs.onActivated.addListener(onActivated)

    return () => {
      cancelled = true
      unsub()
      chrome.tabs.onActivated.removeListener(onActivated)
    }
  }, [])

  const payload = state ? buildPayload(state) : null
  const canExtract = payload !== null && phase !== 'loading'

  async function onExtract() {
    if (!payload) return
    const requestIdentity = identity
    resultIdentityRef.current = requestIdentity
    setPhase('loading')
    setError('')
    setResult(null)
    const msg: ExtractCommand = { type: 'EXTRACT_ATTRIBUTE', payload }
    try {
      const res = (await chrome.runtime.sendMessage(msg)) as ExtractResult
      // The identity may have changed while this request was in flight (e.g. the user
      // switched tabs). If so, this response is stale — drop it silently rather than
      // resurrecting a result/error for a product/attribute that's no longer displayed.
      if (requestIdentity !== currentIdentityRef.current) return
      if (res.ok) {
        setResult({ attribute: res.data.attribute, classification: res.data.classification })
        setPhase('done')
      } else {
        setError(res.error.message)
        setPhase('error')
      }
    } catch {
      if (requestIdentity !== currentIdentityRef.current) return
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
            {state.guidelines.allowedValues.map((v) => (
              <li key={v.value}>
                {v.value}
                {v.note && <span className="text-gray-400"> — {v.note}</span>}
              </li>
            ))}
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
