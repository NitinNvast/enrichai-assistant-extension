# AI-Powered Chrome Extension — Design Spec

**Date:** 2026-07-13
**Status:** Approved for planning
**v1 scope:** Page summarization, end-to-end

---

## 1. Purpose & Goals

Build a **production-ready, AI-powered Chrome extension** that lets a user summarize
the web page they are currently viewing. The user clicks the extension icon, the
extension extracts the page's main content, sends it to an LLM through a backend
proxy, and displays the summary in a side panel. Recent summaries are saved locally.

This is also a **learning project**: the author is an experienced full-stack
developer (JS/TS/React/Node/Docker) but new to Chrome extension development. The
design and implementation should teach Manifest V3 fundamentals and follow
industry best practices, not hide them behind heavy frameworks.

### v1 success criteria

- Load the unpacked extension in Chrome and see a side panel.
- On (almost) any web page, click the icon → get a coherent summary within a few seconds.
- The OpenAI API key is **never** present in the extension bundle — it lives only on the backend.
- The last N summaries are viewable in a history list.
- Restricted pages, extraction failures, and backend errors produce clear, friendly messages instead of crashes.
- Backend and extension pure-logic have automated tests; no real LLM calls in tests.

### Explicit non-goals for v1 (deferred, but designed for)

- Q&A / chat over the page, structured extraction, classification, workflow automation.
- User accounts, backend-persisted history, billing.
- Streaming token-by-token output (designed to be addable; not in v1).
- Automatic background summarization of every page.
- Publishing to the Chrome Web Store (we build to be publishable; publishing is a later step).

---

## 2. Key Decisions (with rationale)

| Decision | Choice | Why |
|----------|--------|-----|
| v1 AI feature | **Page summarization** | Simplest complete pass through the whole pipeline; every future feature reuses the same extract → clean → send → display flow. |
| LLM access | **Backend proxy** | API key never ships to clients. Enables rate limiting, logging, cost control, model swaps. Production-standard. |
| UI surface | **Side panel** (Chrome Side Panel API, Chrome 114+) | Persistent, roomy, grows into chat later. |
| Site scope | **All sites, user-triggered** | Privacy-friendly; no background scraping. Uses `activeTab` so no broad host-permission warning. |
| Extension stack | **Vite + CRXJS + React + TypeScript + Tailwind** | Current industry-standard DX; HMR for extensions; teaches how MV3 works underneath. |
| Persistence | **`chrome.storage.local`, last N summaries** | Cheap, teaches storage API, no DB needed. |
| Content extraction | **Mozilla Readability + fallback** | Battle-tested article extraction; DOM-text fallback for non-article pages. |
| Backend framework | **Python + FastAPI + Pydantic** | Typed I/O, auto OpenAPI docs, async. Uvicorn server. |
| Dependency mgmt | **`uv` + `pyproject.toml`** | Fast, modern Python best-practice. |
| LLM provider/model | **OpenAI `gpt-4o-mini`** (default), swappable to `gpt-4o` via env | Cheap, fast, strong at summarization. |

---

## 3. Architecture Overview

Two independently deployable parts in one repo:

1. **Extension** (Manifest V3 client) — runs in Chrome, reads the page, renders UI.
2. **Backend** (Python/FastAPI, Dockerized) — holds the OpenAI key, calls the LLM.

The two communicate over a small, stable HTTP contract (§6). The extension does not
know or care that the backend is Python.

### 3.1 Extension anatomy (MV3 mental model)

MV3 has separate execution "worlds" that cannot call each other directly; they pass
messages. The four units and their single responsibilities:

- **`manifest.json`** — declares permissions, side panel, service worker, icons. The entry point for everything.
- **Service worker** (`background.ts`) — event-driven coordinator. No DOM. Opens the side panel, routes messages, and makes the `fetch` to the backend. This is the only place that talks to the network backend.
- **Content script** (`content.ts`) — the only code with page DOM access. Runs Readability, cleans the text, returns it. Injected **on demand** via `chrome.scripting.executeScript` using the **`activeTab`** permission — Chrome grants temporary access to only the current tab, only when the user invokes the extension. No "read data on all websites" warning.
- **Side panel** (React app) — the UI: Summarize button, loading/empty/error states, the rendered summary, and the history list.

### 3.2 Backend anatomy

- **`app/main.py`** — builds the FastAPI app, registers routers, CORS, exception handlers, rate limiter.
- **`app/routers/`** — HTTP endpoints (`summarize`, `health`).
- **`app/tasks/`** — the **task registry**: each AI feature is a module exposing `{ name, build_prompt, InputModel, OutputModel }`. v1 ships `summarize`.
- **`app/llm/`** — thin OpenAI client wrapper (so the SDK is mockable and swappable).
- **`app/config.py`** — env settings via `pydantic-settings`.
- **`app/schemas.py`** — shared Pydantic request/response models.

---

## 4. Data Flow (the pipeline)

```
[User clicks extension icon]
      │  activeTab permission granted for THIS tab only
      ▼
[Service worker] ──chrome.scripting.executeScript──► [Content script in page]
                                                          │ 1. Readability extracts {title, textContent, excerpt, byline, url}
                                                          │ 2. Clean: collapse whitespace, strip boilerplate,
                                                          │    truncate to a max char/token budget
                                                          ▼
                                                    message → service worker
      ┌───────────────────────────────────────────────────┘
      ▼
[Service worker] ──POST /api/summarize {url,title,content,options?}──► [Backend]
                                                                          │ validate (Pydantic)
                                                                          │ task=summarize → build_prompt
                                                                          │ call OpenAI (gpt-4o-mini)
                                                                          ▼
                                                                   {summary, model, usage}
      ┌───────────────────────────────────────────────────────────────────┘
      ▼
[Service worker] ──message──► [Side panel] renders summary
                                    │
                                    ▼
                              chrome.storage.local  (append to history, cap at N)
```

**Note on message routing:** the side panel initiates the request (button click). It
messages the service worker, which owns injection + the backend `fetch`, then
messages the result back. Centralizing network + injection in the service worker
keeps the React UI pure and testable.

---

## 5. Content Extraction & Preprocessing

1. **Extract** — run Mozilla `@mozilla/readability` on a clone of `document`. Produces `{ title, textContent, excerpt, byline, length }`.
2. **Fallback** — if Readability returns nothing usable (e.g., non-article page), fall back to a targeted DOM-text grab (`main`, `article`, `p` text; skip `nav/header/footer/script/style`). If that is also empty, last-resort `document.body.innerText`.
3. **Clean/preprocess** (pure function, unit-tested):
   - Collapse repeated whitespace and blank lines.
   - Strip obvious boilerplate remnants.
   - Enforce a **max size budget** (chars mapped to an approximate token budget). If exceeded, truncate and set a `truncated: true` flag surfaced to the user.
4. **Restricted-page guard** — before injecting, detect URLs the extension cannot run on (`chrome://*`, `chrome-extension://*`, Chrome Web Store, `file://` PDFs, `about:*`) and show a friendly "Can't summarize this page" message instead of attempting injection.

---

## 6. Backend API Contract

### `GET /health`
→ `200 { "status": "ok" }`

### `POST /api/summarize`
Request:
```json
{
  "url": "https://example.com/article",
  "title": "Article title",
  "content": "cleaned main text ...",
  "options": { "length": "short | medium | long" }
}
```
Response `200`:
```json
{
  "summary": "….",
  "model": "gpt-4o-mini",
  "usage": { "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0 },
  "truncated": false
}
```
Error responses use a consistent shape:
```json
{ "error": { "code": "string", "message": "human friendly" } }
```
Error codes (initial set): `invalid_request` (422), `content_too_large` (413),
`rate_limited` (429), `upstream_error` (502, OpenAI failure), `internal` (500).

**Validation:** Pydantic models enforce presence/length of `content`, valid `url`,
and allowed `options.length`. Requests over the size limit are rejected with
`content_too_large`.

---

## 7. Extensibility: adding future AI features

The design makes each future feature (Q&A, structured extraction, classification,
workflow steps) a small addition, not a rewrite:

- **Backend:** add a new module under `app/tasks/` implementing the task interface
  (`name`, `build_prompt`, `InputModel`, `OutputModel`) and a route (or a shared
  `/api/ai` dispatcher keyed on `task`). The OpenAI wrapper, config, CORS, rate
  limiting, and error handling are all reused.
- **Extension:** the extract → clean pipeline is shared library code. A new feature
  is a new side-panel "mode" that calls a different task with the same extracted
  content. Q&A additionally keeps a message thread in React state.

---

## 8. Security & Production Hardening

- **API key** only in backend env (`OPENAI_API_KEY`); never referenced in extension code or bundle.
- **CORS** restricted to the extension origin (`chrome-extension://<id>`) plus localhost during dev.
- **Rate limiting** via `slowapi` (per-IP; tunable via env).
- **Request-size limits** enforced at the app layer and reflected in the `content_too_large` error.
- **Structured logging** (request id, model, token usage, latency); never log full page content at info level.
- **Exception handlers** convert unexpected errors into the standard error shape without leaking internals.
- **Config via env** (`pydantic-settings`): `OPENAI_API_KEY`, `OPENAI_MODEL`, `PORT`, `ALLOWED_ORIGINS`, rate-limit settings, max content size.
- **Honest limitation:** a published extension's identity is not a secret, so for a
  truly public deployment you would add real user auth in a later phase. v1 relies on
  CORS + rate limiting, which is appropriate for local/private use and as a learning baseline.

---

## 9. Error Handling (user-facing)

| Situation | Behavior |
|-----------|----------|
| Restricted page (`chrome://`, Web Store, PDF, etc.) | "Can't summarize this page" before any injection. |
| No article found | Fallback extraction; if still empty, "Couldn't find readable content." |
| Content too large | Truncate to budget, summarize, and show a "summarized a portion" notice. |
| Backend unreachable | "Service unavailable — retry" with a retry button. |
| Rate limited / upstream error | Friendly message; retry with backoff. |
| Unexpected error | Generic "Something went wrong" + logged detail on backend. |

---

## 10. Project Structure

```
ai-powered-chrome-extension/
├── extension/                       # Vite + CRXJS + React + TS + Tailwind
│   ├── src/
│   │   ├── background/              # service worker
│   │   ├── content/                # content script (Readability + clean)
│   │   ├── sidepanel/              # React UI
│   │   ├── lib/                    # messaging, extraction, cleaning, storage, api client
│   │   └── types/                  # shared TS types (mirror backend contract)
│   ├── manifest.config.ts
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
├── backend/                        # Python + FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py               # pydantic-settings
│   │   ├── schemas.py              # Pydantic request/response models
│   │   ├── routers/                # summarize.py, health.py
│   │   ├── tasks/                  # summarize.py (task registry)
│   │   └── llm/                    # openai_client.py wrapper
│   ├── tests/                      # pytest
│   ├── pyproject.toml              # uv-managed
│   ├── .env.example
│   └── Dockerfile
├── docker-compose.yml
├── docs/superpowers/specs/         # this spec lives here
└── README.md
```

Backend and extension are **two independent projects** (separate dependency trees),
tied together only by the HTTP contract and a top-level `docker-compose.yml`. This
keeps each simple to reason about while learning.

---

## 11. Testing Strategy

- **Backend (pytest):**
  - Unit: text cleaning, `build_prompt`, task input/output validation.
  - Integration: `POST /api/summarize` with the **OpenAI SDK mocked** — asserts contract, validation errors, and error mapping. No real API calls, no key needed.
- **Extension (Vitest):**
  - Unit: cleaning/preprocessing pure functions, restricted-page detection, API client request shaping.
  - Manual: load unpacked, verify on real article and non-article pages.
- **Test-first** where practical (pure functions), per the project's TDD practice.

---

## 12. Phased Build Plan (each phase is runnable)

0. **Scaffold** — repo, both projects, docker-compose, README.
1. **Backend summarize endpoint** — FastAPI app, config, task registry, OpenAI wrapper, `/health` + `/api/summarize`. Verify with `curl` (mock or real key). Tests.
2. **Extension shell** — manifest, service worker, side panel React "hello world". Load unpacked; side panel opens.
3. **Extraction** — content script with Readability + fallback + cleaning; `activeTab` injection; log extracted text.
4. **Wire it together** — side panel → service worker → backend → render summary.
5. **History** — save/read last N summaries in `chrome.storage.local`; history list UI.
6. **Polish** — full error handling, loading/empty states, summary-length option, tests, README run instructions.

---

## 13. Open Questions / Future Work

- Streaming output (SSE) for perceived speed — deferred to v1.1.
- Real user auth for public deployment — deferred.
- Additional AI tasks (Q&A, extraction, classification) — enabled by the task registry.
- Chrome Web Store packaging & publishing — later.
