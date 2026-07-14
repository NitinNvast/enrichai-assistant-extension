import { BACKEND_URL } from '../constants'
import type { ApiError, ExtractRequest, ExtractResponse } from '../types'

export class ApiClientError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'ApiClientError'
  }
}

export async function requestExtraction(payload: ExtractRequest): Promise<ExtractResponse> {
  let resp: Response
  try {
    resp = await fetch(`${BACKEND_URL}/api/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new ApiClientError('network_error', 'Could not reach the extraction service.')
  }

  if (!resp.ok) {
    let code = 'upstream_error'
    let message = 'The extraction service returned an error.'
    try {
      const body = (await resp.json()) as ApiError
      if (body.error?.code) code = body.error.code
      if (body.error?.message) message = body.error.message
    } catch {
      // keep defaults if body is not JSON
    }
    throw new ApiClientError(code, message)
  }

  return (await resp.json()) as ExtractResponse
}
