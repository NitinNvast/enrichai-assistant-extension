export type SummaryLength = 'short' | 'medium' | 'long'

export interface SummarizeRequest {
  url: string
  title: string
  content: string
  options: { length: SummaryLength }
}

export interface Usage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface SummarizeResponse {
  summary: string
  model: string
  usage: Usage
  truncated: boolean
}

export interface ApiError {
  error: { code: string; message: string }
}

export interface ExtractedContent {
  title: string
  url: string
  content: string
  truncated: boolean
}

// side panel -> service worker
export interface SummarizeCommand {
  type: 'SUMMARIZE_ACTIVE_TAB'
  options: { length: SummaryLength }
}

// service worker -> side panel
export type SummarizeResult =
  | { ok: true; data: SummarizeResponse; page: { title: string; url: string } }
  | { ok: false; error: { code: string; message: string } }

// service worker -> content script
export interface ExtractCommand {
  type: 'EXTRACT'
}

// content script -> service worker
export type ExtractResult =
  | { ok: true; data: ExtractedContent }
  | { ok: false; error: { code: string; message: string } }
