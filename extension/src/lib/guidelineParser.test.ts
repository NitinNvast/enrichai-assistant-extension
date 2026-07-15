// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { parseGuidelines } from './guidelineParser'

function domFrom(html: string): Document {
  document.body.innerHTML = html
  return document
}

// Mirrors the real EnrichAI markup: an "Instructions" block (h6 + readonly
// textarea) followed by N value entries, each a <div> with a direct-child <h6>
// (the allowed value) and a direct-child <p> (a per-value note, often empty).
const GUIDELINES = `
  <div class="sc-lgaxkE">
    <div class="sc-kuXGAk">
      <div class="sc-cExorF"><div class="sc-dsJwGW"><h6>Instructions</h6><button>edit</button></div></div>
      <textarea readonly>Apply the US children size that matches the SKU.</textarea>
    </div>
    <div class="sc-dpAfbZ"><h6>Active/Athletic Footwear</h6><p>Running Shoes, Training Shoes</p></div>
    <div class="sc-dpAfbZ"><h6>0-3 Months</h6><p>Infant</p></div>
    <div class="sc-dpAfbZ"><h6>10.5 cm</h6><p></p></div>
    <div class="sc-dpAfbZ"><h6>Large</h6><p>for infant slippers or soft shoes</p></div>
  </div>
`

describe('parseGuidelines', () => {
  it('extracts allowed values with per-value notes and instructions from the textarea', () => {
    const g = parseGuidelines(domFrom(GUIDELINES), 'Size - Footwear Children')
    expect(g).toEqual({
      attributeName: 'Size - Footwear Children',
      instructions: 'Apply the US children size that matches the SKU.',
      allowedValues: [
        { value: 'Active/Athletic Footwear', note: 'Running Shoes, Training Shoes' },
        { value: '0-3 Months', note: 'Infant' },
        { value: '10.5 cm', note: '' },
        { value: 'Large', note: 'for infant slippers or soft shoes' },
      ],
    })
  })

  it('keeps only the values after the entry matching the attributeName (drops context headers)', () => {
    const html = `
      <div class="sc-lgaxkE">
        <div class="sc-kuXGAk"><div><div><h6>Instructions</h6></div></div><textarea></textarea></div>
        <div class="sc-dpAfbZ"><h6>Active/Athletic Footwear</h6><p>Running Shoes, Training Shoes</p></div>
        <div class="sc-dpAfbZ"><h6>Fit - Shoe Width</h6><p>The fit of the shoe in respect to width</p></div>
        <div class="sc-dpAfbZ"><h6>Extra Wide</h6><p></p></div>
        <div class="sc-dpAfbZ"><h6>Narrow</h6><p></p></div>
        <div class="sc-dpAfbZ"><h6>Regular</h6><p>Includes medium</p></div>
        <div class="sc-dpAfbZ"><h6>Wide</h6><p></p></div>
      </div>
    `
    const g = parseGuidelines(domFrom(html), 'Fit - Shoe Width')
    expect(g?.allowedValues).toEqual([
      { value: 'Extra Wide', note: '' },
      { value: 'Narrow', note: '' },
      { value: 'Regular', note: 'Includes medium' },
      { value: 'Wide', note: '' },
    ])
  })

  it('keeps all entries when no entry matches the attributeName (fallback)', () => {
    const g = parseGuidelines(domFrom(GUIDELINES), 'Attribute Not Present In Block')
    expect(g?.allowedValues.map((v) => v.value)).toEqual([
      'Active/Athletic Footwear',
      '0-3 Months',
      '10.5 cm',
      'Large',
    ])
  })

  it('returns empty instructions when the textarea is empty', () => {
    const html = `
      <div class="sc-lgaxkE">
        <div class="sc-kuXGAk"><div><div><h6>Instructions</h6></div></div><textarea readonly></textarea></div>
        <div class="sc-dpAfbZ"><h6>0-3 Months</h6><p>Infant</p></div>
      </div>
    `
    const g = parseGuidelines(domFrom(html), 'Size - Footwear Children')
    expect(g).toEqual({
      attributeName: 'Size - Footwear Children',
      instructions: '',
      allowedValues: [{ value: '0-3 Months', note: 'Infant' }],
    })
  })

  it('returns null when there are no value entries', () => {
    const html = `
      <div class="sc-lgaxkE">
        <div class="sc-kuXGAk"><div><div><h6>Instructions</h6></div></div><textarea readonly></textarea></div>
      </div>
    `
    expect(parseGuidelines(domFrom(html), 'Size - Footwear Children')).toBeNull()
  })

  it('returns null when there is no guidelines block at all', () => {
    expect(parseGuidelines(domFrom(`<div><p>nothing here</p></div>`), 'Size - Footwear Children')).toBeNull()
  })

  it('picks the block with the most entries, ignoring stray h6/p pairs elsewhere', () => {
    const html = `
      <main>
        <div class="related"><div><h6>Related Item A</h6><p>decoy</p></div></div>
        ${GUIDELINES}
      </main>
    `
    const g = parseGuidelines(domFrom(html), 'Size - Footwear Children')
    expect(g?.allowedValues.map((a) => a.value)).toEqual([
      'Active/Athletic Footwear',
      '0-3 Months',
      '10.5 cm',
      'Large',
    ])
  })
})
