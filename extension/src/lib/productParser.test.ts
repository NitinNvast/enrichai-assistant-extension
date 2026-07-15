// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { parseProduct } from './productParser'

function docFrom(html: string): Document {
  document.body.innerHTML = html
  return document
}

// Mirrors the real EnrichAI product panel: an inline panel (NOT a dialog) with
// an image carousel followed by label/value rows, each a <div> whose two
// direct-child <div>s are the label and the value.
const PRODUCT = `
  <div class="sc-euCvGe">
    <div class="sc-kkmEpK">
      <div class="keen-slider"><div class="slide"><div><div><img src="x.jpg"></div></div></div></div>
    </div>
    <ul class="sc-hcQkXk">
      <div class="sc-jSnYIU"><div>Classification Product Type</div><div><div>Active/Athletic Footwear  </div></div></div>
      <div class="sc-jSnYIU"><div>Product ID</div><div>1154600894_1196642214</div></div>
      <div class="sc-jSnYIU"><div>Product URL</div><div><a href="https://liverpool.com.mx/x"><button><svg></svg></button></a></div></div>
      <div class="sc-jSnYIU"><div>Product Name</div><div>Pikolinos Aranda leather sneakers for men</div></div>
      <div class="sc-jSnYIU"><div>Brand</div><div>Pikolinos</div></div>
      <div class="sc-jSnYIU"><div>Description</div><div>Product Sneakers Sole type Rigid Material Leather</div></div>
      <div class="sc-jSnYIU"><div>Created At</div><div>May 05, 2026</div></div>
      <div class="sc-jSnYIU"><div>Categories</div><div>-</div></div>
    </ul>
  </div>
`

describe('parseProduct', () => {
  it('locates the inline product panel and extracts name, description, and specifications', () => {
    expect(parseProduct(docFrom(PRODUCT))).toEqual({
      productName: 'Pikolinos Aranda leather sneakers for men',
      description: 'Product Sneakers Sole type Rigid Material Leather',
      specifications: {
        'Classification Product Type': 'Active/Athletic Footwear',
        'Product ID': '1154600894_1196642214',
        Brand: 'Pikolinos',
        'Created At': 'May 05, 2026',
        Categories: '-',
      },
    })
  })

  it('omits rows whose value has no text (e.g. the Product URL link)', () => {
    expect(parseProduct(docFrom(PRODUCT))?.specifications).not.toHaveProperty('Product URL')
  })

  it('scopes specifications to the product panel, ignoring unrelated label/value rows elsewhere', () => {
    const withDecoy = `
      <div class="sidebar"><div><div>Filter</div><div>Applied</div></div></div>
      ${PRODUCT}
    `
    expect(parseProduct(docFrom(withDecoy))?.specifications).not.toHaveProperty('Filter')
  })

  it('ignores grid column headers labeled "Product Name" (empty value) and picks the detail card', () => {
    // The product-list grid renders "Product Name" as a column header whose
    // value cell is empty, inside a header container that does NOT hold the
    // detail card. It precedes the detail card in document order.
    const grid = `
      <div class="table">
        <div class="header">
          <div class="cell"><div>Product ID</div><div></div></div>
          <div class="cell"><div>Product Name</div><div></div></div>
          <div class="cell"><div>Reviewed</div><div></div></div>
        </div>
      </div>
    `
    const p = parseProduct(docFrom(grid + PRODUCT))
    expect(p?.productName).toBe('Pikolinos Aranda leather sneakers for men')
    expect(p?.specifications).not.toHaveProperty('Reviewed')
  })

  it('returns null when there is no Product Name row', () => {
    const doc = docFrom(`
      <ul>
        <div class="sc-jSnYIU"><div>Brand</div><div>Pikolinos</div></div>
        <div class="sc-jSnYIU"><div>Description</div><div>desc</div></div>
      </ul>
    `)
    expect(parseProduct(doc)).toBeNull()
  })
})
