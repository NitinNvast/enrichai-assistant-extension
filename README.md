# EnrichAI Assistant

Detect and extract product attributes from e-commerce pages with structured LLM classification.
A Manifest V3 Chrome extension (side panel) backed by a FastAPI proxy that keeps the OpenAI key server-side.

Only runs on `cc.gbiqa.groupbycloud.com/enrich/enrichai/*` pages.

## How it works

1. **Detect**: The extension watches for attribute names (buttons, labels) on the product page.
2. **Extract**: On click, it sends the attribute, product data, and page context to the backend.
3. **Classify**: The backend uses OpenAI (defaults to `gpt-4o`) with structured output to return a single classified value.

**Note**: DOM selectors in `extension/src/constants.ts` are placeholders to be tightened against live markup (see spec §15).

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
# enrichai-assistant-extension
