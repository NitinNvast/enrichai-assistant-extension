# Extension Client (MV3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Manifest V3 Chrome extension that, on user click, extracts the current page's main content, sends it to the FastAPI backend, and shows the summary in a side panel with a local history list.

**Architecture:** Four MV3 units that communicate by message passing. The **side panel** (React) drives the flow. It messages the **service worker**, which owns network + injection: it injects the **content script** on demand (using `activeTab`), asks it to extract via Mozilla Readability, then POSTs the cleaned content to the backend and returns the summary. Pure logic (cleaning, restricted-page detection, API client, history capping) lives in `src/lib` and is unit-tested; DOM/Chrome-API glue is verified manually by loading the extension.

**Tech Stack:** Vite, `@crxjs/vite-plugin`, React 18, TypeScript, Tailwind CSS 3, `@mozilla/readability`, Vitest.

**Prerequisite:** The backend from `2026-07-13-backend-summarizer-api.md` is running on `http://localhost:8000` (needed for Task 6's end-to-end check).

## Global Constraints

- Manifest V3 only. Permissions limited to `activeTab`, `scripting`, `sidePanel`, `storage` — **no broad host permissions** (privacy: `activeTab` grants access only to the current tab on user click).
- TypeScript `strict` mode on.
- All API/message types live in `src/types/index.ts` and must match the backend contract in the design spec §6.
- Backend base URL comes from `import.meta.env.VITE_BACKEND_URL`, defaulting to `http://localhost:8000`.
- The OpenAI key is never referenced anywhere in the extension.
- Working directory for all extension commands is `extension/`.
- Run tests with `npm run test` (Vitest). Build with `npm run build`.

---

### Task 1: Scaffold the extension and load a "hello world" side panel

**Files:**
- Create: `extension/package.json`
- Create: `extension/tsconfig.json`
- Create: `extension/vite.config.ts`
- Create: `extension/vitest.config.ts`
- Create: `extension/manifest.config.ts`
- Create: `extension/tailwind.config.ts`
- Create: `extension/postcss.config.js`
- Create: `extension/src/vite-env.d.ts`
- Create: `extension/src/background/index.ts`
- Create: `extension/src/sidepanel/index.html`
- Create: `extension/src/sidepanel/main.tsx`
- Create: `extension/src/sidepanel/App.tsx`
- Create: `extension/src/sidepanel/index.css`
- Create: `extension/.gitignore`

**Interfaces:**
- Produces: a loadable MV3 extension whose side panel opens on toolbar-icon click.

- [ ] **Step 1: Create `extension/package.json`**

```json
{
  "name": "ai-summarizer-extension",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@mozilla/readability": "^0.5.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.0-beta.28",
    "@types/chrome": "^0.0.270",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.39",
    "tailwindcss": "^3.4.6",
    "typescript": "^5.5.3",
    "vite": "^5.3.4",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Create `extension/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "types": ["chrome", "vite/client", "node"]
  },
  "include": ["src", "manifest.config.ts", "vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: Create `extension/manifest.config.ts`**

```ts
import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'AI Page Summarizer',
  version: '0.1.0',
  description: 'Summarize the current web page with AI.',
  action: { default_title: 'Summarize this page' },
  background: { service_worker: 'src/background/index.ts', type: 'module' },
  side_panel: { default_path: 'src/sidepanel/index.html' },
  permissions: ['activeTab', 'scripting', 'sidePanel', 'storage'],
})
```

- [ ] **Step 4: Create `extension/vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.config'

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  server: { port: 5173, strictPort: true, hmr: { port: 5173 } },
})
```

- [ ] **Step 5: Create `extension/vitest.config.ts`** (separate config so CRXJS does not run during tests)

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 6: Create `extension/tailwind.config.ts` and `extension/postcss.config.js`**

`tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config
```

`postcss.config.js`:
```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
}
```

- [ ] **Step 7: Create `extension/src/vite-env.d.ts`** (types for CRXJS `?script` imports)

```ts
/// <reference types="vite/client" />

declare module '*?script' {
  const src: string
  export default src
}

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

- [ ] **Step 8: Create the side panel files**

`extension/src/sidepanel/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Summarizer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

`extension/src/sidepanel/main.tsx`:
```tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

`extension/src/sidepanel/App.tsx`:
```tsx
export default function App() {
  return (
    <div className="p-4 text-sm">
      <h1 className="text-base font-semibold">AI Page Summarizer</h1>
      <p className="mt-2 text-gray-500">Side panel is working.</p>
    </div>
  )
}
```

`extension/src/sidepanel/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 9: Create the service worker `extension/src/background/index.ts`**

```ts
// Open the side panel when the toolbar icon is clicked.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})
})
```

- [ ] **Step 10: Create `extension/.gitignore`**

```
node_modules/
dist/
*.log
```

- [ ] **Step 11: Install and build**

Run:
```bash
cd extension && npm install && npm run build
```
Expected: `npm install` succeeds; `npm run build` produces a `dist/` folder with `manifest.json` inside.

- [ ] **Step 12: Load the unpacked extension and verify the side panel**

Manual:
1. Open `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked**, select `extension/dist`.
3. Click the extension's toolbar icon.

Expected: the side panel opens showing "AI Page Summarizer / Side panel is working."

- [ ] **Step 13: Commit**

```bash
git add extension/
git commit -m "feat(extension): scaffold MV3 side-panel extension with Vite/CRXJS/React/Tailwind"
```

---

### Task 2: Shared types and pure helpers (restricted-page + text cleaning)

**Files:**
- Create: `extension/src/types/index.ts`
- Create: `extension/src/lib/restricted.ts`
- Create: `extension/src/lib/clean.ts`
- Test: `extension/src/lib/restricted.test.ts`
- Test: `extension/src/lib/clean.test.ts`

**Interfaces:**
- Produces (types): `SummaryLength = 'short'|'medium'|'long'`; `SummarizeRequest`, `Usage`, `SummarizeResponse`, `ApiError` (mirror backend §6); `ExtractedContent { title:string; url:string; content:string; truncated:boolean }`; message types `SummarizeCommand`, `SummarizeResult`, `ExtractCommand`, `ExtractResult`.
- Produces: `isRestrictedUrl(url: string | undefined): boolean`.
- Produces: `cleanText(raw: string): string`; `truncate(text: string, max?: number): { text: string; truncated: boolean }`; constant `MAX_CONTENT_CHARS = 40000`.

- [ ] **Step 1: Create `extension/src/types/index.ts`**

```ts
export type SummaryLength = 'short' | 'medium' | 'long'

export interface SummarizeRequest {
  url: string
  title: string
  content: string
  options: { length: SummaryLength }
}

export interface Usage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface SummarizeResponse {
  summary: string
  model: string
  usage: Usage
  truncated: boolean
}

export interface ApiError {
  error: { code: string; message: string }
}

export interface ExtractedContent {
  title: string
  url: string
  content: string
  truncated: boolean
}

// side panel -> service worker
export interface SummarizeCommand {
  type: 'SUMMARIZE_ACTIVE_TAB'
  options: { length: SummaryLength }
}

// service worker -> side panel
export type SummarizeResult =
  | { ok: true; data: SummarizeResponse; page: { title: string; url: string } }
  | { ok: false; error: { code: string; message: string } }

// service worker -> content script
export interface ExtractCommand {
  type: 'EXTRACT'
}

// content script -> service worker
export type ExtractResult =
  | { ok: true; data: ExtractedContent }
  | { ok: false; error: { code: string; message: string } }
```

- [ ] **Step 2: Write the failing test — `extension/src/lib/restricted.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { isRestrictedUrl } from './restricted'

describe('isRestrictedUrl', () => {
  it('flags chrome internal pages', () => {
    expect(isRestrictedUrl('chrome://extensions')).toBe(true)
  })
  it('flags the chrome web store', () => {
    expect(isRestrictedUrl('https://chromewebstore.google.com/detail/abc')).toBe(true)
  })
  it('flags undefined urls', () => {
    expect(isRestrictedUrl(undefined)).toBe(true)
  })
  it('allows normal http(s) pages', () => {
    expect(isRestrictedUrl('https://example.com/article')).toBe(false)
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd extension && npm run test -- restricted`
Expected: FAIL — cannot resolve `./restricted`.

- [ ] **Step 4: Create `extension/src/lib/restricted.ts`**

```ts
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
```

- [ ] **Step 5: Write the failing test — `extension/src/lib/clean.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { cleanText, truncate } from './clean'

describe('cleanText', () => {
  it('collapses runs of spaces and tabs', () => {
    expect(cleanText('a    b\t\tc')).toBe('a b c')
  })
  it('trims each line and drops excess blank lines', () => {
    expect(cleanText('  hi  \n\n\n\n  there  ')).toBe('hi\n\nthere')
  })
})

describe('truncate', () => {
  it('leaves short text unchanged', () => {
    expect(truncate('hello', 10)).toEqual({ text: 'hello', truncated: false })
  })
  it('cuts long text and flags truncation', () => {
    expect(truncate('abcdef', 3)).toEqual({ text: 'abc', truncated: true })
  })
})
```

- [ ] **Step 6: Run to verify it fails**

Run: `cd extension && npm run test -- clean`
Expected: FAIL — cannot resolve `./clean`.

- [ ] **Step 7: Create `extension/src/lib/clean.ts`**

```ts
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
```

- [ ] **Step 8: Run to verify all pass**

Run: `cd extension && npm run test`
Expected: all restricted + clean tests PASS.

- [ ] **Step 9: Commit**

```bash
git add extension/src/types extension/src/lib/restricted.ts extension/src/lib/clean.ts extension/src/lib/restricted.test.ts extension/src/lib/clean.test.ts
git commit -m "feat(extension): add shared types, restricted-url and text-cleaning helpers"
```

---

### Task 3: Backend API client

**Files:**
- Create: `extension/src/lib/api.ts`
- Test: `extension/src/lib/api.test.ts`

**Interfaces:**
- Consumes: `SummarizeRequest`, `SummarizeResponse`, `ApiError` from `../types`.
- Produces: `requestSummary(payload: SummarizeRequest): Promise<SummarizeResponse>`; `class ApiClientError extends Error { code: string }`. On non-2xx it throws `ApiClientError` carrying the backend `error.code`; on network failure it throws `ApiClientError('network_error', ...)`.

- [ ] **Step 1: Write the failing test — `extension/src/lib/api.test.ts`**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestSummary } from './api'
import type { SummarizeRequest } from '../types'

const payload: SummarizeRequest = {
  url: 'https://x.com',
  title: 't',
  content: 'c',
  options: { length: 'short' },
}

afterEach(() => vi.restoreAllMocks())

describe('requestSummary', () => {
  it('returns the parsed body on 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            summary: 'S',
            model: 'gpt-4o-mini',
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            truncated: false,
          }),
          { status: 200 },
        ),
      ),
    )
    const res = await requestSummary(payload)
    expect(res.summary).toBe('S')
  })

  it('throws with the backend error code on non-200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { code: 'rate_limited', message: 'slow' } }), {
          status: 429,
        }),
      ),
    )
    await expect(requestSummary(payload)).rejects.toMatchObject({ code: 'rate_limited' })
  })

  it('throws network_error when fetch rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
    await expect(requestSummary(payload)).rejects.toMatchObject({ code: 'network_error' })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd extension && npm run test -- api`
Expected: FAIL — cannot resolve `./api`.

- [ ] **Step 3: Create `extension/src/lib/api.ts`**

```ts
import type { ApiError, SummarizeRequest, SummarizeResponse } from '../types'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

export class ApiClientError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'ApiClientError'
  }
}

export async function requestSummary(payload: SummarizeRequest): Promise<SummarizeResponse> {
  let resp: Response
  try {
    resp = await fetch(`${BACKEND_URL}/api/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new ApiClientError('network_error', 'Could not reach the summarizer service.')
  }

  if (!resp.ok) {
    let code = 'upstream_error'
    let message = 'The summarizer service returned an error.'
    try {
      const body = (await resp.json()) as ApiError
      if (body.error?.code) code = body.error.code
      if (body.error?.message) message = body.error.message
    } catch {
      // keep defaults if body is not JSON
    }
    throw new ApiClientError(code, message)
  }

  return (await resp.json()) as SummarizeResponse
}
```

- [ ] **Step 4: Run to verify all pass**

Run: `cd extension && npm run test -- api`
Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add extension/src/lib/api.ts extension/src/lib/api.test.ts
git commit -m "feat(extension): add backend API client with typed error handling"
```

---

### Task 4: Content script — Readability extraction

**Files:**
- Create: `extension/src/lib/extract.ts`
- Create: `extension/src/content/index.ts`

**Interfaces:**
- Consumes: `cleanText`, `truncate` from `../lib/clean`; `ExtractedContent`, `ExtractCommand`, `ExtractResult` from `../types`.
- Produces: `extractContent(): ExtractedContent` (runs in page context); a content-script entry that answers `{type:'EXTRACT'}` messages with an `ExtractResult`, guarded against duplicate listeners.

> **Note on testing:** `extract.ts` and `content/index.ts` touch the live DOM and `chrome.runtime`, so they are verified manually in Task 6 (end-to-end), not with Vitest. Keep them thin; all testable logic already lives in `clean.ts`.

- [ ] **Step 1: Create `extension/src/lib/extract.ts`**

```ts
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
```

- [ ] **Step 2: Create `extension/src/content/index.ts`**

```ts
import type { ExtractCommand, ExtractResult } from '../types'
import { extractContent } from '../lib/extract'

// Guard: executeScript may inject this file more than once per page.
const win = window as unknown as { __aiSummarizerLoaded?: boolean }

if (!win.__aiSummarizerLoaded) {
  win.__aiSummarizerLoaded = true

  chrome.runtime.onMessage.addListener((msg: ExtractCommand, _sender, sendResponse) => {
    if (msg?.type !== 'EXTRACT') return
    try {
      const data = extractContent()
      const result: ExtractResult = { ok: true, data }
      sendResponse(result)
    } catch (err) {
      const result: ExtractResult = {
        ok: false,
        error: { code: 'extract_error', message: (err as Error).message },
      }
      sendResponse(result)
    }
    return true // keep the message channel open for the async response
  })
}
```

- [ ] **Step 3: Verify it builds**

Run: `cd extension && npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add extension/src/lib/extract.ts extension/src/content/index.ts
git commit -m "feat(extension): add Readability content extraction and content script"
```

---

### Task 5: Service worker orchestration

**Files:**
- Modify: `extension/src/background/index.ts`

**Interfaces:**
- Consumes: `contentScriptPath` (via `../content/index?script`), `requestSummary`/`ApiClientError` from `../lib/api`, `isRestrictedUrl` from `../lib/restricted`, message types from `../types`.
- Produces: a `chrome.runtime.onMessage` handler for `SummarizeCommand` that returns a `SummarizeResult`.

- [ ] **Step 1: Replace `extension/src/background/index.ts` with the orchestration logic**

```ts
import contentScriptPath from '../content/index?script'
import { ApiClientError, requestSummary } from '../lib/api'
import { isRestrictedUrl } from '../lib/restricted'
import type { ExtractResult, SummarizeCommand, SummarizeResult } from '../types'

// Open the side panel when the toolbar icon is clicked.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})
})

chrome.runtime.onMessage.addListener((msg: SummarizeCommand, _sender, sendResponse) => {
  if (msg?.type !== 'SUMMARIZE_ACTIVE_TAB') return
  handleSummarize(msg).then(sendResponse)
  return true // async response
})

async function handleSummarize(msg: SummarizeCommand): Promise<SummarizeResult> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || isRestrictedUrl(tab.url)) {
    return { ok: false, error: { code: 'restricted_page', message: "This page can't be summarized." } }
  }

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [contentScriptPath] })
  } catch {
    return { ok: false, error: { code: 'injection_failed', message: "Couldn't read this page." } }
  }

  let extracted: ExtractResult
  try {
    extracted = (await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT' })) as ExtractResult
  } catch {
    return { ok: false, error: { code: 'extract_failed', message: "Couldn't read this page." } }
  }
  if (!extracted.ok) return { ok: false, error: extracted.error }

  const { title, url, content, truncated } = extracted.data
  if (!content.trim()) {
    return { ok: false, error: { code: 'empty_content', message: 'No readable content found on this page.' } }
  }

  try {
    const data = await requestSummary({ url, title, content, options: msg.options })
    return {
      ok: true,
      data: { ...data, truncated: data.truncated || truncated },
      page: { title, url },
    }
  } catch (err) {
    const e = err as ApiClientError
    return { ok: false, error: { code: e.code ?? 'unknown', message: e.message } }
  }
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd extension && npm run build`
Expected: build succeeds. (The `?script` import resolves via `vite-env.d.ts` from Task 1.)

- [ ] **Step 3: Commit**

```bash
git add extension/src/background/index.ts
git commit -m "feat(extension): orchestrate inject -> extract -> summarize in service worker"
```

---

### Task 6: Side panel UI wired end-to-end

**Files:**
- Modify: `extension/src/sidepanel/App.tsx`

**Interfaces:**
- Consumes: `chrome.runtime.sendMessage` with `SummarizeCommand`, receives `SummarizeResult`.
- Produces: the working summarize UI (length selector, button, loading/idle/error/done states, truncation notice).

- [ ] **Step 1: Replace `extension/src/sidepanel/App.tsx`**

```tsx
import { useState } from 'react'
import type { SummarizeResult, SummaryLength } from '../types'

type Status = 'idle' | 'loading' | 'done' | 'error'

export default function App() {
  const [status, setStatus] = useState<Status>('idle')
  const [summary, setSummary] = useState('')
  const [error, setError] = useState('')
  const [truncated, setTruncated] = useState(false)
  const [length, setLength] = useState<SummaryLength>('medium')

  async function onSummarize() {
    setStatus('loading')
    setError('')
    setSummary('')
    setTruncated(false)

    const result = (await chrome.runtime.sendMessage({
      type: 'SUMMARIZE_ACTIVE_TAB',
      options: { length },
    })) as SummarizeResult

    if (result.ok) {
      setSummary(result.data.summary)
      setTruncated(result.data.truncated)
      setStatus('done')
    } else {
      setError(result.error.message)
      setStatus('error')
    }
  }

  return (
    <div className="flex h-screen flex-col gap-3 p-4 text-sm">
      <h1 className="text-base font-semibold">AI Page Summarizer</h1>

      <div className="flex items-center gap-2">
        <select
          value={length}
          onChange={(e) => setLength(e.target.value as SummaryLength)}
          className="rounded border px-2 py-1"
          disabled={status === 'loading'}
        >
          <option value="short">Short</option>
          <option value="medium">Medium</option>
          <option value="long">Long</option>
        </select>
        <button
          onClick={onSummarize}
          disabled={status === 'loading'}
          className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {status === 'loading' ? 'Summarizing…' : 'Summarize'}
        </button>
      </div>

      {status === 'idle' && <p className="text-gray-500">Click Summarize to get started.</p>}
      {status === 'error' && <p className="rounded bg-red-50 p-2 text-red-700">{error}</p>}
      {status === 'done' && (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {truncated && (
            <p className="text-xs text-amber-600">Note: only part of the page was summarized.</p>
          )}
          <div className="flex-1 overflow-y-auto whitespace-pre-wrap rounded border p-3">
            {summary}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build and reload the extension**

Run: `cd extension && npm run build`
Then in `chrome://extensions`, click the reload icon on the extension.

- [ ] **Step 3: End-to-end manual verification** (backend must be running on `:8000`)

1. Start the backend: `cd backend && uv run uvicorn app.main:app --port 8000` (with a real `OPENAI_API_KEY` in `backend/.env`).
2. Open a normal article page (e.g. a news article or Wikipedia).
3. Click the extension icon → the side panel opens.
4. Pick a length, click **Summarize**.

Expected: after a few seconds a coherent summary appears. Verify the error paths too:
- On a `chrome://extensions` tab → "This page can't be summarized."
- With the backend stopped → "Could not reach the summarizer service."

- [ ] **Step 4: Commit**

```bash
git add extension/src/sidepanel/App.tsx
git commit -m "feat(extension): wire side panel summarize UI end-to-end"
```

---

### Task 7: Local history (storage) and final polish

**Files:**
- Create: `extension/src/lib/storage.ts`
- Test: `extension/src/lib/storage.test.ts`
- Modify: `extension/src/sidepanel/App.tsx`
- Modify: `README.md` (repo root — add extension section)

**Interfaces:**
- Consumes: `chrome.storage.local`.
- Produces: `HistoryEntry { id, url, title, summary, model, createdAt }`; `prependCapped(entry, existing, max?) : HistoryEntry[]` (pure); `loadHistory(): Promise<HistoryEntry[]>`; `addHistory(entry): Promise<HistoryEntry[]>`; `clearHistory(): Promise<void>`; constant `MAX_ENTRIES = 20`.

- [ ] **Step 1: Write the failing test — `extension/src/lib/storage.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { prependCapped, type HistoryEntry } from './storage'

function entry(id: string): HistoryEntry {
  return { id, url: 'u', title: 't', summary: 's', model: 'm', createdAt: 0 }
}

describe('prependCapped', () => {
  it('puts the newest entry first', () => {
    const result = prependCapped(entry('b'), [entry('a')])
    expect(result.map((e) => e.id)).toEqual(['b', 'a'])
  })
  it('caps the list at max entries', () => {
    const existing = [entry('1'), entry('2'), entry('3')]
    const result = prependCapped(entry('new'), existing, 3)
    expect(result.map((e) => e.id)).toEqual(['new', '1', '2'])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd extension && npm run test -- storage`
Expected: FAIL — cannot resolve `./storage`.

- [ ] **Step 3: Create `extension/src/lib/storage.ts`**

```ts
export interface HistoryEntry {
  id: string
  url: string
  title: string
  summary: string
  model: string
  createdAt: number
}

const KEY = 'summaries'
export const MAX_ENTRIES = 20

export function prependCapped(
  entry: HistoryEntry,
  existing: HistoryEntry[],
  max: number = MAX_ENTRIES,
): HistoryEntry[] {
  return [entry, ...existing].slice(0, max)
}

export async function loadHistory(): Promise<HistoryEntry[]> {
  const result = await chrome.storage.local.get(KEY)
  return (result[KEY] as HistoryEntry[]) ?? []
}

export async function addHistory(entry: HistoryEntry): Promise<HistoryEntry[]> {
  const existing = await loadHistory()
  const next = prependCapped(entry, existing)
  await chrome.storage.local.set({ [KEY]: next })
  return next
}

export async function clearHistory(): Promise<void> {
  await chrome.storage.local.remove(KEY)
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd extension && npm run test`
Expected: all tests across the suite PASS.

- [ ] **Step 5: Update `extension/src/sidepanel/App.tsx` to save and show history**

Replace the whole file with:
```tsx
import { useEffect, useState } from 'react'
import type { SummarizeResult, SummaryLength } from '../types'
import {
  addHistory,
  clearHistory,
  loadHistory,
  type HistoryEntry,
} from '../lib/storage'

type Status = 'idle' | 'loading' | 'done' | 'error'

function makeId(url: string): string {
  return `${url}::${performance.now()}`
}

export default function App() {
  const [status, setStatus] = useState<Status>('idle')
  const [summary, setSummary] = useState('')
  const [error, setError] = useState('')
  const [truncated, setTruncated] = useState(false)
  const [length, setLength] = useState<SummaryLength>('medium')
  const [history, setHistory] = useState<HistoryEntry[]>([])

  useEffect(() => {
    loadHistory().then(setHistory)
  }, [])

  async function onSummarize() {
    setStatus('loading')
    setError('')
    setSummary('')
    setTruncated(false)

    const result = (await chrome.runtime.sendMessage({
      type: 'SUMMARIZE_ACTIVE_TAB',
      options: { length },
    })) as SummarizeResult

    if (result.ok) {
      setSummary(result.data.summary)
      setTruncated(result.data.truncated)
      setStatus('done')
      const entry: HistoryEntry = {
        id: makeId(result.page.url),
        url: result.page.url,
        title: result.page.title,
        summary: result.data.summary,
        model: result.data.model,
        createdAt: Date.now(),
      }
      setHistory(await addHistory(entry))
    } else {
      setError(result.error.message)
      setStatus('error')
    }
  }

  async function onClearHistory() {
    await clearHistory()
    setHistory([])
  }

  return (
    <div className="flex h-screen flex-col gap-3 p-4 text-sm">
      <h1 className="text-base font-semibold">AI Page Summarizer</h1>

      <div className="flex items-center gap-2">
        <select
          value={length}
          onChange={(e) => setLength(e.target.value as SummaryLength)}
          className="rounded border px-2 py-1"
          disabled={status === 'loading'}
        >
          <option value="short">Short</option>
          <option value="medium">Medium</option>
          <option value="long">Long</option>
        </select>
        <button
          onClick={onSummarize}
          disabled={status === 'loading'}
          className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {status === 'loading' ? 'Summarizing…' : 'Summarize'}
        </button>
      </div>

      {status === 'idle' && <p className="text-gray-500">Click Summarize to get started.</p>}
      {status === 'error' && <p className="rounded bg-red-50 p-2 text-red-700">{error}</p>}
      {status === 'done' && (
        <div className="flex flex-col gap-2">
          {truncated && (
            <p className="text-xs text-amber-600">Note: only part of the page was summarized.</p>
          )}
          <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded border p-3">
            {summary}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Recent</h2>
            <button onClick={onClearHistory} className="text-xs text-gray-500 hover:underline">
              Clear
            </button>
          </div>
          <ul className="flex-1 overflow-y-auto">
            {history.map((h) => (
              <li key={h.id} className="border-b py-2">
                <p className="truncate font-medium" title={h.title}>
                  {h.title || h.url}
                </p>
                <p className="line-clamp-3 text-gray-600">{h.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Add the extension section to `README.md` (repo root)**

Append:
```markdown
## Extension (Chrome MV3)

### Build & load
```bash
cd extension
npm install
npm run build
```
Then open `chrome://extensions`, enable Developer mode, click **Load unpacked**,
and select `extension/dist`. Make sure the backend is running on `http://localhost:8000`.

### Test
```bash
cd extension && npm run test
```

### Note on icons
Toolbar/store icons are omitted for local dev (Chrome shows a default icon). Before
publishing, add 16/48/128px PNGs under `extension/public/icons/` and reference them
via an `icons` field in `manifest.config.ts`.
```

- [ ] **Step 7: Full verification**

Run:
```bash
cd extension && npm run test && npm run build
```
Expected: all tests PASS, build succeeds.

Then reload the extension and confirm: summarize a page → summary shows and a "Recent" entry appears; reopen the panel → history persists; "Clear" empties it.

- [ ] **Step 8: Commit**

```bash
git add extension/src/lib/storage.ts extension/src/lib/storage.test.ts extension/src/sidepanel/App.tsx README.md
git commit -m "feat(extension): add local summary history with storage and history UI"
```

---

## Self-Review Notes (author checklist — verified)

- **Spec coverage:** detect page (Task 5 restricted check) · read/extract DOM (Task 4 Readability + fallback) · clean/preprocess (Task 2 `cleanText`/`truncate`) · send to LLM via backend (Task 3 api client + Task 5 orchestration) · display in side panel (Tasks 1,6) · save conversations (Task 7 storage) · `activeTab` privacy pattern (Tasks 1 manifest, 5 injection) · error handling §9 (Tasks 5,6) · testing §11 (Tasks 2,3,7 Vitest) · structure §10 (all tasks).
- **Extensibility (§7):** the extract→clean pipeline (`lib/`) and messaging types are feature-agnostic; a future Q&A/extract feature adds a new command type + backend task, reusing everything else.
- **Type consistency:** `SummarizeResult`/`ExtractResult` discriminated unions used identically in service worker, content script, and side panel; `requestSummary(payload: SummarizeRequest): Promise<SummarizeResponse>` matches the backend §6 contract and the api test mocks; `prependCapped` signature identical in `storage.ts` and its test; `HistoryEntry` fields consistent across `storage.ts` and `App.tsx`.
- **Deferred by design:** streaming, backend-persisted history, auth, Web Store publishing (spec §1/§13 non-goals).
