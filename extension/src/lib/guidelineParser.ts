import { SELECTORS } from '../constants'
import type { Guideline } from '../types'

export function parseGuidelines(root: Document | Element, attributeName: string): Guideline | null {
  const section = findGuidelinesSection(root)
  if (!section) return null

  const allowedValues = Array.from(section.querySelectorAll('li'))
    .map((li) => li.textContent?.trim() ?? '')
    .filter(Boolean)
  if (allowedValues.length === 0) return null

  const instructions = Array.from(section.querySelectorAll('p'))
    .map((p) => p.textContent?.trim() ?? '')
    .filter(Boolean)
    .join(' ')

  return { attributeName, instructions, allowedValues }
}

function findGuidelinesSection(root: Document | Element): Element | null {
  const configured = root.querySelector(SELECTORS.guidelinesSection)
  if (configured) return configured
  // Fallback: a heading whose text mentions "guidelines".
  const headings = Array.from(root.querySelectorAll('h1, h2, h3, h4'))
  const heading = headings.find((el) => /guidelines/i.test(el.textContent ?? ''))
  return heading?.closest('section, div') ?? heading?.parentElement ?? null
}
