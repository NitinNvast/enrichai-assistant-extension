import { SELECTORS } from '../constants'
import type { Guideline } from '../types'

export function parseGuidelines(root: Document | Element, attributeName: string): Guideline | null {
  const found = findGuidelinesSection(root)
  if (!found) return null
  const { section, heading } = found

  // A section may contain multiple lists (e.g. an <ol> of instructions
  // followed by the actual <ul> of allowed values). Only ever look inside
  // <ul>/<ol> elements, and prefer the LAST list in the section — the
  // common convention is prose/instructions first, allowed values last.
  //
  // When the section was found via the heading fallback (see
  // findGuidelinesSection), the container can be a broad <main>/<article>
  // that also holds unrelated content (e.g. a decoy list, related items,
  // pagination) before or after the actual guidelines block. To avoid
  // silently picking up a list that has nothing to do with the heading,
  // restrict candidates to lists that come AFTER the heading in document
  // order before choosing the last one.
  const lists = Array.from(section.querySelectorAll('ul, ol'))
  const candidateLists = heading
    ? lists.filter((el) => (heading.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0)
    : lists
  const lastList = candidateLists[candidateLists.length - 1]
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

interface GuidelinesSection {
  section: Element
  // The heading that led to `section` being picked via the fallback path, or
  // null when `section` came from the configured selector (in which case the
  // whole section is trusted content and no document-position filtering is
  // needed).
  heading: Element | null
}

function findGuidelinesSection(root: Document | Element): GuidelinesSection | null {
  const configured = root.querySelector(SELECTORS.guidelinesSection)
  if (configured) return { section: configured, heading: null }
  // Fallback: a heading whose text mentions "guidelines".
  // NOTE: this takes the FIRST matching heading with no disambiguation, so an
  // earlier decoy heading (e.g. a nav breadcrumb reading "Guidelines") could be
  // picked over the real content heading. Known limitation; a markup-informed
  // pass is expected to tighten this later.
  const headings = Array.from(root.querySelectorAll('h1, h2, h3, h4'))
  const heading = headings.find((el) => /guidelines/i.test(el.textContent ?? ''))
  if (!heading) return null
  const section = heading.closest('section, div, main, article') ?? heading.parentElement
  return section ? { section, heading } : null
}
