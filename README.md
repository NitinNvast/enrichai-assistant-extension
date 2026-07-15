# EnrichAI Assistant

Detect and extract product attributes from e-commerce pages with structured LLM classification.
A Manifest V3 Chrome extension (side panel) backed by a FastAPI proxy that keeps the OpenAI key server-side.

Only runs on `cc.gbiqa.groupbycloud.com/enrich/enrichai/*` pages.

## How it works

1. **Detect**: The extension watches for attribute names (buttons, labels) on the product page.
2. **Extract**: On click, it sends the attribute, product data, and page context to the backend.
3. **Classify**: The backend uses OpenAI (defaults to `gpt-4o`) with structured output to return the allowed value(s) that apply.

The extension never talks to OpenAI directly — every LLM call goes through the FastAPI backend, which holds the API key.

## Prerequisites

| Component | Requirement |
| --------- | ----------- |
| Backend (local) | Python **3.12+** and [`uv`](https://docs.astral.sh/uv/) |
| Backend (Docker) | Docker + Docker Compose |
| Extension | Node.js **18+** and npm |
| Both | An **OpenAI API key** with access to the configured model (`gpt-4o` by default) |

## Repo layout

```
.
├── backend/            # FastAPI proxy (OpenAI key lives here)
├── extension/          # Chrome MV3 extension (side panel)
└── docker-compose.yml  # Runs the backend in a container
```

---

## Backend (FastAPI)

The backend exposes `POST /api/extract` and `GET /health`. Run it **either** locally with `uv` **or** in Docker — not both at once (they both bind port 8000).

### Environment variables

Copy `backend/.env.example` to `backend/.env` and fill it in. `.env` is gitignored.

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `OPENAI_API_KEY` | *(empty)* | **Required.** Your OpenAI key. |
| `OPENAI_MODEL` | `gpt-4o` | Model used for classification. |
| `ALLOWED_ORIGINS` | `*` | Comma-separated CORS origins. `*` is fine for local dev. |
| `PORT` | `8000` | Port the server listens on. |
| `MAX_CONTENT_CHARS` | `40000` | Max characters of product content accepted per request. |
| `RATE_LIMIT` | `20/minute` | Per-IP rate limit (in-memory; per process). |

### Option A — Local dev (uv)

```bash
cd backend
cp .env.example .env          # then edit .env and set OPENAI_API_KEY
uv sync                       # install dependencies into a local .venv
uv run uvicorn app.main:app --reload --port 8000
```

Verify it's up:

```bash
curl http://localhost:8000/health      # -> {"status":"ok"}
```

- Interactive API docs: http://localhost:8000/docs
- `--reload` restarts the server on code changes (drop it for a non-dev run).

### Option B — Docker

Runs the backend in a container using `backend/.env` for configuration.

```bash
# from the repo root, with backend/.env populated (see above)
docker compose up --build backend
```

The container exposes the API on http://localhost:8000 (same health check and docs URLs as above). Stop it with `Ctrl+C`, or run detached with `docker compose up -d --build backend` and stop with `docker compose down`.

> **Note:** `docker-compose.yml` only defines the **backend** service. The extension is always built locally and loaded into Chrome (see below) — it is not containerized.

### Test

```bash
cd backend && uv run pytest -v
```

---

## Extension (Chrome MV3)

The extension is built with Vite + crxjs and loaded unpacked into Chrome. It calls the backend at `http://localhost:8000` by default (override with `VITE_BACKEND_URL` at build time).

### 1. Install dependencies

```bash
cd extension
npm install
```

### 2. Build

```bash
npm run build            # outputs to extension/dist
```

To point the build at a non-default backend, set the URL at build time:

```bash
VITE_BACKEND_URL=https://your-backend.example.com npm run build
```

### 3. Load into Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the `extension/dist` folder.
4. Make sure the backend is running (local or Docker) at the URL the extension was built with — `http://localhost:8000` by default.

### 4. Use it

1. Navigate to a page under `https://cc.gbiqa.groupbycloud.com/enrich/enrichai/…`.
2. Click the extension's toolbar icon to open the side panel (it's scoped to this host — it stays closed elsewhere).
3. When a product and attribute are detected, click **Extract Attribute** to run the classification.

### Dev mode (hot reload)

For iterative development you can run the Vite dev server instead of rebuilding by hand:

```bash
cd extension
npm run dev
```

Load `extension/dist` as above; crxjs reloads the extension on source changes. (Already-open EnrichAI tabs are reloaded automatically so a fresh content script is injected.)

### Test

```bash
cd extension && npm run test
```

---

## Quick start (end-to-end)

```bash
# 1. Backend
cd backend
cp .env.example .env && $EDITOR .env      # set OPENAI_API_KEY
uv sync
uv run uvicorn app.main:app --reload --port 8000

# 2. Extension (in a second terminal)
cd extension
npm install
npm run build
# then load extension/dist via chrome://extensions -> Load unpacked
```

---

## Notes

- **DOM parsing is structural.** The EnrichAI app ships styled-components class hashes that change every build, so `guidelineParser.ts` and `productParser.ts` key off DOM structure rather than class names. A significant UI redesign of EnrichAI can break detection silently — validate the parsers against live markup if detection stops working.
- **Icons.** Toolbar/store icons are omitted for local dev (Chrome shows a default icon). Before publishing to the Chrome Web Store, add 16/48/128px PNGs under `extension/public/icons/` and reference them via an `icons` field in `manifest.config.ts`.

See `docs/superpowers/` for the design docs and implementation plans.
