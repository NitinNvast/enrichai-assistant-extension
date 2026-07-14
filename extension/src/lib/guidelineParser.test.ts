// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { parseGuidelines } from './guidelineParser'

function domFrom(html: string): Document {
  document.body.innerHTML = html
  return document
}

describe('parseGuidelines', () => {
  it('extracts allowed values and instructions from the guidelines section', () => {
    const doc = domFrom(`
      <section class="guidelines">
        <h3>Guidelines</h3>
        <p>Classify shoe width using product title, description and specifications.</p>
        <ul><li>Narrow</li><li>Standard</li><li>Wide</li><li>Extra Wide</li></ul>
      </section>
    `)
    const g = parseGuidelines(doc, 'Fit - Shoe Width')
    expect(g).toEqual({
      attributeName: 'Fit - Shoe Width',
      instructions: 'Classify shoe width using product title, description and specifications.',
      allowedValues: ['Narrow', 'Standard', 'Wide', 'Extra Wide'],
    })
  })

  it('returns null when there is no guidelines section', () => {
    const doc = domFrom(`<section><p>nothing here</p></section>`)
    expect(parseGuidelines(doc, 'Fit - Shoe Width')).toBeNull()
  })

  it('returns null when the section has no allowed values', () => {
    const doc = domFrom(`<section class="guidelines"><p>desc only</p></section>`)
    expect(parseGuidelines(doc, 'Fit - Shoe Width')).toBeNull()
  })

  it('prefers the last list when the section has multiple lists (e.g. instructions before allowed values)', () => {
    const doc = domFrom(`
      <section class="guidelines">
        <h3>Guidelines</h3>
        <p>Classify shoe width using product title, description and specifications.</p>
        <ol><li>Read the product title</li><li>Check the specifications table</li></ol>
        <ul><li>Narrow</li><li>Standard</li><li>Wide</li></ul>
      </section>
    `)
    const g = parseGuidelines(doc, 'Fit - Shoe Width')
    expect(g).toEqual({
      attributeName: 'Fit - Shoe Width',
      instructions: 'Classify shoe width using product title, description and specifications.',
      allowedValues: ['Narrow', 'Standard', 'Wide'],
    })
  })

  it('falls back to a heading whose text mentions "guidelines" when there is no .guidelines section', () => {
    const doc = domFrom(`
      <main>
        <h2>Sizing Guidelines</h2>
        <p>Classify shoe width using product title, description and specifications.</p>
        <ul><li>Narrow</li><li>Standard</li><li>Wide</li><li>Extra Wide</li></ul>
      </main>
    `)
    const g = parseGuidelines(doc, 'Fit - Shoe Width')
    expect(g).toEqual({
      attributeName: 'Fit - Shoe Width',
      instructions: 'Classify shoe width using product title, description and specifications.',
      allowedValues: ['Narrow', 'Standard', 'Wide', 'Extra Wide'],
    })
  })

  it('ignores unrelated lists that precede the heading in a broad fallback container', () => {
    const doc = domFrom(`
      <main>
        <ul><li>Related Item A</li><li>Related Item B</li></ul>
        <h2>Sizing Guidelines</h2>
        <p>Classify shoe width using product title, description and specifications.</p>
        <ol><li>Read the product title</li><li>Check the specifications table</li></ol>
        <ul><li>Narrow</li><li>Standard</li><li>Wide</li></ul>
      </main>
    `)
    const g = parseGuidelines(doc, 'Fit - Shoe Width')
    expect(g).toEqual({
      attributeName: 'Fit - Shoe Width',
      instructions: 'Classify shoe width using product title, description and specifications.',
      allowedValues: ['Narrow', 'Standard', 'Wide'],
    })
  })
})
