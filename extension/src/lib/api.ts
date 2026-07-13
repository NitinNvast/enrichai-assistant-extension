import type { ApiError, SummarizeRequest, SummarizeResponse } from '../types'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

export class ApiClientError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'ApiClientError'
  }
}

export async function requestSummary(payload: SummarizeRequest): Promise<SummarizeResponse> {
  let resp: Response
  try {
    resp = await fetch(`${BACKEND_URL}/api/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new ApiClientError('network_error', 'Could not reach the summarizer service.')
  }

  if (!resp.ok) {
    let code = 'upstream_error'
    let message = 'The summarizer service returned an error.'
    try {
      const body = (await resp.json()) as ApiError
      if (body.error?.code) code = body.error.code
      if (body.error?.message) message = body.error.message
    } catch {
      // keep defaults if body is not JSON
    }
    throw new ApiClientError(code, message)
  }

  return (await resp.json()) as SummarizeResponse
}
