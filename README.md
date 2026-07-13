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

## Extension

See `docs/superpowers/plans/` for the extension implementation plan.
