import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestSummary } from './api'
import type { SummarizeRequest } from '../types'

const payload: SummarizeRequest = {
  url: 'https://x.com',
  title: 't',
  content: 'c',
  options: { length: 'short' },
}

afterEach(() => vi.restoreAllMocks())

describe('requestSummary', () => {
  it('returns the parsed body on 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            summary: 'S',
            model: 'gpt-4o-mini',
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            truncated: false,
          }),
          { status: 200 },
        ),
      ),
    )
    const res = await requestSummary(payload)
    expect(res.summary).toBe('S')
  })

  it('throws with the backend error code on non-200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { code: 'rate_limited', message: 'slow' } }), {
          status: 429,
        }),
      ),
    )
    await expect(requestSummary(payload)).rejects.toMatchObject({ code: 'rate_limited' })
  })

  it('throws network_error when fetch rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
    await expect(requestSummary(payload)).rejects.toMatchObject({ code: 'network_error' })
  })
})
