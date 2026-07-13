# AI-Powered Chrome Extension

Summarize any web page with an LLM. A Manifest V3 Chrome extension (side panel)
backed by a FastAPI proxy that keeps the OpenAI key server-side.

## Backend (FastAPI)

### Local dev
```bash
cd backend
cp .env.example .env        # then edit .env and set OPENAI_API_KEY
uv sync
uv run uvicorn app.main:app --reload --port 8000
```
- Health check: `curl http://localhost:8000/health`
- API docs: http://localhost:8000/docs

### Test
```bash
cd backend && uv run pytest -v
```

### Docker
```bash
# from repo root, with backend/.env populated
docker compose up --build backend
```

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

See `docs/superpowers/plans/` for the extension implementation plan.
# ai-page-summarizer-extension
