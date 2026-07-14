import { SELECTORS } from '../constants'
import type { Product } from '../types'

function text(el: Element | null): string {
  return el?.textContent?.trim() ?? ''
}

export function parseProduct(modal: Element): Product | null {
  const productName = text(modal.querySelector(SELECTORS.productName))
  if (!productName) return null

  const description = text(modal.querySelector(SELECTORS.description))

  const specifications: Record<string, string> = {}
  modal.querySelectorAll(SELECTORS.specRow).forEach((row) => {
    const label = text(row.querySelector(SELECTORS.specLabel))
    const value = text(row.querySelector(SELECTORS.specValue))
    if (label && value) specifications[label] = value
  })

  return { productName, description, specifications }
}
