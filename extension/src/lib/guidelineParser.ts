import { SELECTORS } from '../constants'
import type { Guideline } from '../types'

export function parseGuidelines(root: Document | Element, attributeName: string): Guideline | null {
  const section = findGuidelinesSection(root)
  if (!section) return null

  // A section may contain multiple lists (e.g. an <ol> of instructions
  // followed by the actual <ul> of allowed values). Only ever look inside
  // <ul>/<ol> elements, and prefer the LAST list in the section — the
  // common convention is prose/instructions first, allowed values last.
  const lists = Array.from(section.querySelectorAll('ul, ol'))
  const lastList = lists[lists.length - 1]
  const allowedValues = lastList
    ? Array.from(lastList.querySelectorAll('li'))
        .map((li) => li.textContent?.trim() ?? '')
        .filter(Boolean)
    : []
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
  // NOTE: this takes the FIRST matching heading with no disambiguation, so an
  // earlier decoy heading (e.g. a nav breadcrumb reading "Guidelines") could be
  // picked over the real content heading. Known limitation; a markup-informed
  // pass is expected to tighten this later.
  const headings = Array.from(root.querySelectorAll('h1, h2, h3, h4'))
  const heading = headings.find((el) => /guidelines/i.test(el.textContent ?? ''))
  return heading?.closest('section, div, main, article') ?? heading?.parentElement ?? null
}
