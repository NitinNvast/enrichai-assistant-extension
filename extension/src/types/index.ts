export interface UrlContext {
  projectId: string | null
  catalogId: string | null
  terminalNodeId: string | null
  attributeName: string | null // [T] prefix stripped
}

// One allowed value plus the per-value note the guidelines panel shows beside
// it (often empty). `note` is retained for the classifier's benefit; the wire
// payload still sends only the bare `value` strings (see ExtractRequest) so the
// backend's allowed-value validation matches exactly.
export interface AllowedValue {
  value: string
  note: string
}

export interface Guideline {
  attributeName: string
  instructions: string
  allowedValues: AllowedValue[]
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
