export const TARGET_HOST = 'cc.gbiqa.groupbycloud.com'
export const TARGET_PATH_PREFIX = '/enrich/enrichai/'

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

// Strips a leading type marker like "[T]" from the URL attributeName.
export const ATTR_TYPE_PREFIX = /^\[[A-Za-z]\]\s*/

// DOM heuristics — placeholders, tighten against live EnrichAI markup (spec §15).
export const SELECTORS = {
  modal: '[role="dialog"]',
  guidelinesSection: '.guidelines',
  productName: '[data-field="product-name"]',
  description: '[data-field="description"]',
  specRow: 'dl > div, .spec-row',
  specLabel: 'dt, .spec-label',
  specValue: 'dd, .spec-value',
} as const
