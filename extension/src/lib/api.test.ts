import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiClientError, requestExtraction } from './api'
import type { ExtractRequest } from '../types'

const PAYLOAD: ExtractRequest = {
  attributeName: 'Fit - Shoe Width',
  guidelines: { instructions: 'x', allowedValues: ['Wide'] },
  product: { name: 'Shoe', description: 'd', specifications: {} },
  context: { projectId: null, catalogId: null, terminalNodeId: null },
}

afterEach(() => vi.unstubAllGlobals())

describe('requestExtraction', () => {
  it('returns parsed data on success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ attribute: 'Fit - Shoe Width', classification: 'Wide', model: 'gpt-4o' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    const data = await requestExtraction(PAYLOAD)
    expect(data.classification).toBe('Wide')
  })

  it('throws ApiClientError with the backend error code', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: { code: 'upstream_error', message: 'boom' } }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )))
    await expect(requestExtraction(PAYLOAD)).rejects.toMatchObject({ code: 'upstream_error' })
  })

  it('throws network_error when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    await expect(requestExtraction(PAYLOAD)).rejects.toBeInstanceOf(ApiClientError)
  })
})
