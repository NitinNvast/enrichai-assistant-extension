import { Readability } from '@mozilla/readability'
import type { ExtractedContent } from '../types'
import { cleanText, truncate } from './clean'

export function extractContent(): ExtractedContent {
  const url = document.location.href
  let title = document.title
  let text = ''

  try {
    const clone = document.cloneNode(true) as Document
    const article = new Readability(clone).parse()
    if (article?.textContent && article.textContent.trim().length > 200) {
      title = article.title || title
      text = article.textContent
    }
  } catch {
    // fall through to fallback extraction
  }

  if (!text) text = fallbackExtract()

  const cleaned = cleanText(text)
  const { text: finalText, truncated } = truncate(cleaned)
  return { title, url, content: finalText, truncated }
}

function fallbackExtract(): string {
  const scope = document.querySelector('main, article') ?? document.body
  if (!scope) return ''
  const parts: string[] = []
  scope.querySelectorAll('p, h1, h2, h3, li').forEach((el) => {
    const t = el.textContent?.trim()
    if (t) parts.push(t)
  })
  if (parts.length === 0) return document.body?.innerText ?? ''
  return parts.join('\n')
}
