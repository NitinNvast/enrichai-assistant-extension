import type { Product } from '../types'

function text(el: Element | null): string {
  return el?.textContent?.trim() ?? ''
}

// The EnrichAI product panel is an inline block (NOT a dialog) holding a list of
// label/value rows: each row is a <div> whose first two direct-child <div>s are
// the label and the value. Name and description are two such rows; everything
// else becomes a specification.
//
// The styled-components class names are unstable, so we don't anchor on them.
// Instead we find the panel by locating the "Product Name" row and scoping to
// its container, then read the remaining rows within — this keeps unrelated
// label/value pairs elsewhere on the page out of the specifications.
const NAME_LABEL = 'Product Name'
const DESCRIPTION_LABEL = 'Description'

export function parseProduct(root: Document | Element): Product | null {
  const panel = findProductPanel(root)
  if (!panel) return null

  const rows = collectRows(panel)
  const productName = rows[NAME_LABEL] ?? ''
  if (!productName) return null

  const description = rows[DESCRIPTION_LABEL] ?? ''

  const specifications: Record<string, string> = {}
  for (const [label, value] of Object.entries(rows)) {
    if (label === NAME_LABEL || label === DESCRIPTION_LABEL) continue
    // Rows whose value renders as an icon/link (e.g. Product URL) have no text.
    if (value) specifications[label] = value
  }

  return { productName, description, specifications }
}

// The container holding all the product rows, found via the "Product Name" row.
// The product-list grid also renders "Product Name" as a column header, but with
// an empty value cell — so we require a non-empty value to skip those and lock
// onto the detail card, whose Product Name row carries the actual name.
function findProductPanel(root: Document | Element): Element | null {
  const nameRow = Array.from(root.querySelectorAll('div'))
    .filter(isRow)
    .find((row) => {
      const cells = row.querySelectorAll(':scope > div')
      return text(cells[0]) === NAME_LABEL && text(cells[1]) !== ''
    })
  return nameRow?.parentElement ?? null
}

function isRow(el: Element): boolean {
  return el.querySelectorAll(':scope > div').length >= 2
}

function collectRows(panel: Element): Record<string, string> {
  const rows: Record<string, string> = {}
  panel.querySelectorAll('div').forEach((el) => {
    if (!isRow(el)) return
    const cells = el.querySelectorAll(':scope > div')
    const label = text(cells[0])
    if (label) rows[label] = text(cells[1])
  })
  return rows
}
