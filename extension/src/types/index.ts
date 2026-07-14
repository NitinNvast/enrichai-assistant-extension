export interface UrlContext {
  projectId: string | null
  catalogId: string | null
  terminalNodeId: string | null
  attributeName: string | null // [T] prefix stripped
}

export interface Guideline {
  attributeName: string
  instructions: string
  allowedValues: string[]
}

export interface Product {
  productName: string
  description: string
  specifications: Record<string, string>
}

export interface DetectionState {
  supportedPage: boolean
  context: UrlContext | null
  guidelines: Guideline | null
  product: Product | null
}

export interface ExtractRequest {
  attributeName: string
  guidelines: { instructions: string; allowedValues: string[] }
  product: { name: string; description: string; specifications: Record<string, string> }
  context: { projectId: string | null; catalogId: string | null; terminalNodeId: string | null }
}

export interface ExtractResponse {
  attribute: string
  classification: string
  model: string
}

export interface ApiError {
  error: { code: string; message: string }
}

// content script -> service worker
export interface StateUpdateMessage {
  type: 'STATE_UPDATE'
  state: DetectionState
}

// side panel -> service worker
export interface ExtractCommand {
  type: 'EXTRACT_ATTRIBUTE'
  payload: ExtractRequest
}

// service worker -> side panel
export type ExtractResult =
  | { ok: true; data: ExtractResponse }
  | { ok: false; error: { code: string; message: string } }
