const RESTRICTED_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'about:',
  'view-source:',
  'https://chrome.google.com/webstore',
  'https://chromewebstore.google.com',
]

export function isRestrictedUrl(url: string | undefined): boolean {
  if (!url) return true
  return RESTRICTED_PREFIXES.some((prefix) => url.startsWith(prefix))
}
