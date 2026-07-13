export const MAX_CONTENT_CHARS = 40_000

export function cleanText(raw: string): string {
  return raw
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function truncate(
  text: string,
  max: number = MAX_CONTENT_CHARS,
): { text: string; truncated: boolean } {
  if (text.length <= max) return { text, truncated: false }
  return { text: text.slice(0, max), truncated: true }
}
