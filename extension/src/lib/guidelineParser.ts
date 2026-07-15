import type { AllowedValue, Guideline } from '../types'

// The EnrichAI guidelines panel is a flat block: an "Instructions" sub-block
// (an <h6>Instructions</h6> label next to a readonly <textarea>), followed by
// one <div> per allowed value. Each value entry has a direct-child <h6> (the
// value) and a direct-child <p> (a per-value note, frequently empty).
//
// The block carries no stable id or class — the host app ships styled-components
// hashes that change every build — so we key off structure: value entries are
// the only <div>s with both a direct <h6> and a direct <p>, and the real block
// is the one holding the most of them (guarding against a stray heading/prose
// pair elsewhere on the page).
export function parseGuidelines(root: Document | Element, attributeName: string): Guideline | null {
  const section = findGuidelinesSection(root)
  if (!section) return null

  const entries: AllowedValue[] = section.entries
    .map((entry) => ({
      value: entry.querySelector(':scope > h6')?.textContent?.trim() ?? '',
      note: entry.querySelector(':scope > p')?.textContent?.trim() ?? '',
    }))
    .filter((v) => v.value)

  // The block is prefixed by context headers — the product type, then a row for
  // the attribute itself — before the real allowed values. The attribute row's
  // value equals `attributeName`, so everything AFTER it is the true value list.
  // Fall back to keeping all entries when no such marker is present, so an
  // unexpected layout degrades to over-inclusion rather than dropping everything.
  const markerIndex = entries.findIndex((v) => v.value === attributeName)
  const allowedValues = markerIndex >= 0 ? entries.slice(markerIndex + 1) : entries
  if (allowedValues.length === 0) return null

  // Attribute-level instructions live in the readonly textarea's value, not in
  // any per-value <p>. Empty is a legitimate result (the field is often blank).
  const textarea = section.container.querySelector('textarea')
  const instructions = (textarea instanceof HTMLTextAreaElement ? textarea.value : '').trim()

  return { attributeName, instructions, allowedValues }
}

interface GuidelinesSection {
  container: Element
  entries: Element[]
}

function findGuidelinesSection(root: Document | Element): GuidelinesSection | null {
  const entries = Array.from(root.querySelectorAll('div')).filter(isValueEntry)
  if (entries.length === 0) return null

  // Group entries by their parent and take the parent with the most, so a lone
  // decoy <div><h6/><p/></div> in an unrelated section can't win.
  const byParent = new Map<Element, Element[]>()
  for (const entry of entries) {
    const parent = entry.parentElement
    if (!parent) continue
    const group = byParent.get(parent) ?? []
    group.push(entry)
    byParent.set(parent, group)
  }

  let best: GuidelinesSection | null = null
  for (const [container, group] of byParent) {
    if (!best || group.length > best.entries.length) best = { container, entries: group }
  }
  return best
}

function isValueEntry(el: Element): boolean {
  return el.querySelector(':scope > h6') !== null && el.querySelector(':scope > p') !== null
}
