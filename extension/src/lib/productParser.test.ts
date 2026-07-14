// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { parseProduct } from './productParser'

function modalFrom(html: string): Element {
  document.body.innerHTML = `<div role="dialog">${html}</div>`
  return document.querySelector('[role="dialog"]')!
}

describe('parseProduct', () => {
  it('extracts name, description, and specifications', () => {
    const modal = modalFrom(`
      <h2 data-field="product-name">Nike Air Zoom Pegasus</h2>
      <p data-field="description">Men's running shoes with breathable mesh upper.</p>
      <dl>
        <div><dt>Gender</dt><dd>Men</dd></div>
        <div><dt>Category</dt><dd>Running Shoes</dd></div>
        <div><dt>Material</dt><dd>Mesh</dd></div>
        <div><dt>Fit</dt><dd>Wide Fit</dd></div>
      </dl>
    `)
    expect(parseProduct(modal)).toEqual({
      productName: 'Nike Air Zoom Pegasus',
      description: "Men's running shoes with breathable mesh upper.",
      specifications: { Gender: 'Men', Category: 'Running Shoes', Material: 'Mesh', Fit: 'Wide Fit' },
    })
  })

  it('returns null when there is no product name', () => {
    const modal = modalFrom(`<p data-field="description">desc</p>`)
    expect(parseProduct(modal)).toBeNull()
  })
})
