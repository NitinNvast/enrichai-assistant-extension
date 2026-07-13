# Backend Summarizer API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Python/FastAPI backend that accepts cleaned page content and returns an LLM-generated summary via OpenAI, keeping the API key server-side.

**Architecture:** A small FastAPI app. Requests are validated with Pydantic, routed to a "task" module that builds the LLM prompt, sent to OpenAI through a thin mockable wrapper, and returned in a stable JSON contract. Errors are normalized to one shape. Rate limiting, CORS, and config come from env. Containerized with Docker.

**Tech Stack:** Python 3.12, FastAPI, Uvicorn, Pydantic v2, pydantic-settings, `openai` SDK, slowapi, pytest, httpx (test client), `uv` for dependency management, Docker.

## Global Constraints

- Python `>=3.12`.
- Dependency management: **`uv`** with `pyproject.toml`. Install deps with `uv sync`, run commands with `uv run ...`.
- **The OpenAI API key MUST only ever be read from env (`OPENAI_API_KEY`).** Never hardcode it, never return it, never log it.
- Default model: `gpt-4o-mini` (env `OPENAI_MODEL`, overridable).
- All error responses use the shape `{"error": {"code": "...", "message": "..."}}`.
- No real network/LLM calls in tests — the OpenAI wrapper is always mocked.
- Working directory for all backend commands is `backend/`.

---

### Task 1: Scaffold, config, and health endpoint

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/.env.example`
- Create: `backend/.gitignore`
- Create: `backend/app/__init__.py` (empty)
- Create: `backend/app/config.py`
- Create: `backend/app/routers/__init__.py` (empty)
- Create: `backend/app/routers/health.py`
- Create: `backend/app/main.py`
- Create: `backend/tests/__init__.py` (empty)
- Test: `backend/tests/test_health.py`

**Interfaces:**
- Produces: `app.config.get_settings() -> Settings` (cached). `Settings` fields: `openai_api_key: str`, `openai_model: str = "gpt-4o-mini"`, `allowed_origins: str = "*"`, `port: int = 8000`, `max_content_chars: int = 40000`, `rate_limit: str = "20/minute"`, plus property `origins_list -> list[str]`.
- Produces: `app.main.app` (FastAPI instance). `app.routers.health.router` with `GET /health`.

- [ ] **Step 1: Create `backend/pyproject.toml`**

```toml
[project]
name = "ai-extension-backend"
version = "0.1.0"
description = "Backend proxy for the AI page summarizer extension"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.111",
    "uvicorn[standard]>=0.30",
    "openai>=1.40",
    "pydantic>=2.7",
    "pydantic-settings>=2.3",
    "slowapi>=0.1.9",
]

[dependency-groups]
dev = [
    "pytest>=8",
    "httpx>=0.27",
]

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
```

- [ ] **Step 2: Create `backend/.env.example`**

```bash
# Copy to .env and fill in. .env is gitignored.
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o-mini
# Comma-separated allowed origins. Use "*" for local dev.
ALLOWED_ORIGINS=*
PORT=8000
MAX_CONTENT_CHARS=40000
RATE_LIMIT=20/minute
```

- [ ] **Step 3: Create `backend/.gitignore`**

```
.venv/
__pycache__/
*.pyc
.env
.pytest_cache/
uv.lock
```

- [ ] **Step 4: Create `backend/app/config.py`**

```python
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    allowed_origins: str = "*"
    port: int = 8000
    max_content_chars: int = 40000
    rate_limit: str = "20/minute"

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 5: Create `backend/app/routers/health.py`**

```python
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 6: Create `backend/app/main.py`**

```python
from fastapi import FastAPI

from app.routers import health


def create_app() -> FastAPI:
    app = FastAPI(title="AI Summarizer Backend")
    app.include_router(health.router)
    return app


app = create_app()
```

- [ ] **Step 7: Write the failing test — `backend/tests/test_health.py`**

```python
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
```

- [ ] **Step 8: Install deps and run the test to verify it passes**

Run:
```bash
cd backend && uv sync && uv run pytest tests/test_health.py -v
```
Expected: `test_health_returns_ok PASSED`.

- [ ] **Step 9: Manually confirm the server boots**

Run:
```bash
cd backend && uv run uvicorn app.main:app --port 8000
```
Expected: server starts; `curl http://localhost:8000/health` returns `{"status":"ok"}`; `http://localhost:8000/docs` shows Swagger UI. Stop with Ctrl-C.

- [ ] **Step 10: Commit**

```bash
git add backend/
git commit -m "feat(backend): scaffold FastAPI app with config and health endpoint"
```

---

### Task 2: Request/response schemas and the summarize prompt task

**Files:**
- Create: `backend/app/schemas.py`
- Create: `backend/app/tasks/__init__.py` (empty)
- Create: `backend/app/tasks/summarize.py`
- Test: `backend/tests/test_summarize_task.py`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces (schemas): `SummaryLength = Literal["short","medium","long"]`; `SummarizeOptions(length: SummaryLength = "medium")`; `SummarizeRequest(url: HttpUrl, title: str = "", content: str [min_length=1], options: SummarizeOptions)`; `Usage(prompt_tokens:int, completion_tokens:int, total_tokens:int)`; `SummarizeResponse(summary:str, model:str, usage:Usage, truncated:bool=False)`; `ErrorBody(code:str, message:str)`; `ErrorResponse(error: ErrorBody)`.
- Produces (task): `app.tasks.summarize.build_messages(title: str, url: str, content: str, options: SummarizeOptions) -> list[dict]`.

- [ ] **Step 1: Create `backend/app/schemas.py`**

```python
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl

SummaryLength = Literal["short", "medium", "long"]


class SummarizeOptions(BaseModel):
    length: SummaryLength = "medium"


class SummarizeRequest(BaseModel):
    url: HttpUrl
    title: str = Field(default="", max_length=500)
    content: str = Field(min_length=1)
    options: SummarizeOptions = Field(default_factory=SummarizeOptions)


class Usage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class SummarizeResponse(BaseModel):
    summary: str
    model: str
    usage: Usage
    truncated: bool = False


class ErrorBody(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorBody
```

- [ ] **Step 2: Write the failing test — `backend/tests/test_summarize_task.py`**

```python
from app.schemas import SummarizeOptions
from app.tasks.summarize import build_messages


def test_build_messages_has_system_and_user_roles():
    msgs = build_messages("Title", "https://x.com", "Body text", SummarizeOptions())
    assert [m["role"] for m in msgs] == ["system", "user"]


def test_build_messages_includes_content_and_metadata():
    msgs = build_messages("My Title", "https://x.com/a", "The body", SummarizeOptions())
    user = msgs[1]["content"]
    assert "My Title" in user
    assert "https://x.com/a" in user
    assert "The body" in user


def test_build_messages_length_guidance_changes_with_option():
    short = build_messages("t", "https://x.com", "c", SummarizeOptions(length="short"))[1]["content"]
    long = build_messages("t", "https://x.com", "c", SummarizeOptions(length="long"))[1]["content"]
    assert short != long
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && uv run pytest tests/test_summarize_task.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.tasks.summarize'`.

- [ ] **Step 4: Create `backend/app/tasks/summarize.py`**

```python
from app.schemas import SummarizeOptions

NAME = "summarize"

SYSTEM_PROMPT = (
    "You are a precise summarization assistant. Summarize the provided web page "
    "content faithfully and concisely. Do not add information that is not present. "
    "Ignore navigation menus, ads, cookie notices, and other boilerplate."
)

LENGTH_GUIDANCE: dict[str, str] = {
    "short": "2-3 sentences",
    "medium": "one short paragraph of 4-6 sentences",
    "long": "3-5 concise paragraphs",
}


def build_messages(
    title: str, url: str, content: str, options: SummarizeOptions
) -> list[dict]:
    guidance = LENGTH_GUIDANCE[options.length]
    user = (
        f"Summarize the following web page in {guidance}.\n\n"
        f"Title: {title}\n"
        f"URL: {url}\n\n"
        f"Content:\n{content}"
    )
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user},
    ]
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && uv run pytest tests/test_summarize_task.py -v`
Expected: all 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas.py backend/app/tasks/ backend/tests/test_summarize_task.py
git commit -m "feat(backend): add API schemas and summarize prompt task"
```

---

### Task 3: OpenAI wrapper, error handling, and the summarize route

**Files:**
- Create: `backend/app/llm/__init__.py` (empty)
- Create: `backend/app/llm/openai_client.py`
- Create: `backend/app/errors.py`
- Create: `backend/app/routers/summarize.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_summarize_route.py`

**Interfaces:**
- Consumes: `get_settings`, `SummarizeRequest`, `SummarizeResponse`, `Usage`, `build_messages`.
- Produces: `app.llm.openai_client.summarize_messages(messages: list[dict], model: str) -> tuple[str, dict]` (returns `(text, usage_dict)`; raises `LLMError` on SDK failure). `LLMError(Exception)`.
- Produces: `app.errors.AppError(status:int, code:str, message:str)`, `app.errors.error_response(status, code, message) -> JSONResponse`, `app.errors.register_handlers(app)`.
- Produces: `app.routers.summarize.router` with `POST /api/summarize`.

- [ ] **Step 1: Create `backend/app/llm/openai_client.py`**

```python
from openai import OpenAI, OpenAIError

from app.config import get_settings


class LLMError(Exception):
    """Raised when the OpenAI call fails."""


def summarize_messages(messages: list[dict], model: str) -> tuple[str, dict]:
    settings = get_settings()
    client = OpenAI(api_key=settings.openai_api_key)
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.3,
        )
    except OpenAIError as exc:  # network, auth, rate limit, etc.
        raise LLMError(str(exc)) from exc

    text = resp.choices[0].message.content or ""
    usage = {
        "prompt_tokens": getattr(resp.usage, "prompt_tokens", 0),
        "completion_tokens": getattr(resp.usage, "completion_tokens", 0),
        "total_tokens": getattr(resp.usage, "total_tokens", 0),
    }
    return text, usage
```

- [ ] **Step 2: Create `backend/app/errors.py`**

```python
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, status: int, code: str, message: str):
        self.status = status
        self.code = code
        self.message = message


def error_response(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message}},
    )


def register_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return error_response(exc.status, exc.code, exc.message)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        return error_response(422, "invalid_request", "Request validation failed.")

    @app.exception_handler(Exception)
    async def _unexpected(_: Request, exc: Exception) -> JSONResponse:
        return error_response(500, "internal", "Something went wrong.")
```

- [ ] **Step 3: Create `backend/app/routers/summarize.py`**

```python
from fastapi import APIRouter

from app.config import get_settings
from app.errors import AppError
from app.llm import openai_client
from app.llm.openai_client import LLMError
from app.schemas import SummarizeRequest, SummarizeResponse, Usage
from app.tasks.summarize import build_messages

router = APIRouter(prefix="/api")


@router.post("/summarize", response_model=SummarizeResponse)
def summarize(req: SummarizeRequest) -> SummarizeResponse:
    settings = get_settings()

    # Defense-in-depth abuse ceiling (2x the soft budget).
    if len(req.content) > settings.max_content_chars * 2:
        raise AppError(413, "content_too_large", "Page content is too large to process.")

    content = req.content
    truncated = False
    if len(content) > settings.max_content_chars:
        content = content[: settings.max_content_chars]
        truncated = True

    messages = build_messages(req.title, str(req.url), content, req.options)

    try:
        text, usage = openai_client.summarize_messages(messages, settings.openai_model)
    except LLMError:
        raise AppError(502, "upstream_error", "The summarization service failed.")

    return SummarizeResponse(
        summary=text,
        model=settings.openai_model,
        usage=Usage(**usage),
        truncated=truncated,
    )
```

- [ ] **Step 4: Wire routes + error handlers into `backend/app/main.py`**

Replace the whole file with:
```python
from fastapi import FastAPI

from app.errors import register_handlers
from app.routers import health, summarize


def create_app() -> FastAPI:
    app = FastAPI(title="AI Summarizer Backend")
    register_handlers(app)
    app.include_router(health.router)
    app.include_router(summarize.router)
    return app


app = create_app()
```

- [ ] **Step 5: Write the failing test — `backend/tests/test_summarize_route.py`**

```python
import pytest
from fastapi.testclient import TestClient

from app.llm import openai_client
from app.main import app

client = TestClient(app)

VALID_BODY = {
    "url": "https://example.com/article",
    "title": "Example",
    "content": "This is the article body that should be summarized.",
    "options": {"length": "medium"},
}


@pytest.fixture(autouse=True)
def mock_openai(monkeypatch):
    def fake(messages, model):
        return ("A short summary.", {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15})

    monkeypatch.setattr(openai_client, "summarize_messages", fake)


def test_summarize_success():
    resp = client.post("/api/summarize", json=VALID_BODY)
    assert resp.status_code == 200
    data = resp.json()
    assert data["summary"] == "A short summary."
    assert data["model"]  # non-empty
    assert data["usage"]["total_tokens"] == 15
    assert data["truncated"] is False


def test_summarize_missing_content_is_invalid_request():
    body = {**VALID_BODY}
    del body["content"]
    resp = client.post("/api/summarize", json=body)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "invalid_request"


def test_summarize_upstream_error(monkeypatch):
    def boom(messages, model):
        raise openai_client.LLMError("openai down")

    monkeypatch.setattr(openai_client, "summarize_messages", boom)
    resp = client.post("/api/summarize", json=VALID_BODY)
    assert resp.status_code == 502
    assert resp.json()["error"]["code"] == "upstream_error"


def test_summarize_truncates_long_content(monkeypatch):
    from app.config import get_settings

    settings = get_settings()
    long_body = {**VALID_BODY, "content": "x" * (settings.max_content_chars + 100)}
    resp = client.post("/api/summarize", json=long_body)
    assert resp.status_code == 200
    assert resp.json()["truncated"] is True


def test_summarize_rejects_oversized_content():
    from app.config import get_settings

    settings = get_settings()
    huge = {**VALID_BODY, "content": "x" * (settings.max_content_chars * 2 + 1)}
    resp = client.post("/api/summarize", json=huge)
    assert resp.status_code == 413
    assert resp.json()["error"]["code"] == "content_too_large"
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_summarize_route.py -v`
Expected: all 5 tests PASS. (No `OPENAI_API_KEY` needed — the wrapper is mocked.)

- [ ] **Step 7: Commit**

```bash
git add backend/app/llm/ backend/app/errors.py backend/app/routers/summarize.py backend/app/main.py backend/tests/test_summarize_route.py
git commit -m "feat(backend): add OpenAI wrapper, error handling, and summarize route"
```

---

### Task 4: CORS and rate limiting

**Files:**
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_middleware.py`

**Interfaces:**
- Consumes: `get_settings().origins_list`, `get_settings().rate_limit`.
- Produces: CORS configured from `ALLOWED_ORIGINS`; per-IP rate limiting on `POST /api/summarize`; `RateLimitExceeded` mapped to the `rate_limited` (429) error shape.

- [ ] **Step 1: Add rate limiter to `backend/app/routers/summarize.py`**

Add near the top (after imports):
```python
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
```
Change the route signature and decorator so it reads:
```python
@router.post("/summarize", response_model=SummarizeResponse)
@limiter.limit(lambda: get_settings().rate_limit)
def summarize(request: Request, req: SummarizeRequest) -> SummarizeResponse:
```
(The `request: Request` parameter is required by slowapi; the rest of the function body is unchanged.)

- [ ] **Step 2: Wire CORS + limiter into `backend/app/main.py`**

Replace the whole file with:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded

from app.config import get_settings
from app.errors import error_response, register_handlers
from app.routers import health, summarize
from app.routers.summarize import limiter


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="AI Summarizer Backend")

    app.state.limiter = limiter

    async def _rate_limit_handler(request, exc):
        return error_response(429, "rate_limited", "Too many requests. Please slow down.")

    app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origins_list,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    register_handlers(app)
    app.include_router(health.router)
    app.include_router(summarize.router)
    return app


app = create_app()
```

- [ ] **Step 3: Write the failing test — `backend/tests/test_middleware.py`**

```python
import pytest
from fastapi.testclient import TestClient

from app.llm import openai_client
from app.main import app

client = TestClient(app)

BODY = {
    "url": "https://example.com/a",
    "title": "t",
    "content": "some content",
    "options": {"length": "short"},
}


@pytest.fixture(autouse=True)
def mock_openai(monkeypatch):
    monkeypatch.setattr(
        openai_client,
        "summarize_messages",
        lambda messages, model: ("ok", {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2}),
    )


def test_cors_header_present_for_allowed_origin():
    resp = client.post("/api/summarize", json=BODY, headers={"Origin": "http://localhost:5173"})
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") is not None
```

- [ ] **Step 4: Run the full test suite**

Run: `cd backend && uv run pytest -v`
Expected: every test across all files PASSES.

- [ ] **Step 5: Commit**

```bash
git add backend/app/main.py backend/app/routers/summarize.py backend/tests/test_middleware.py
git commit -m "feat(backend): add CORS and per-IP rate limiting"
```

---

### Task 5: Dockerize, compose, and README with a real end-to-end check

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`
- Create: `docker-compose.yml` (repo root)
- Create: `README.md` (repo root)

**Interfaces:**
- Consumes: the built backend app.
- Produces: `docker compose up backend` serving on `localhost:8000`.

- [ ] **Step 1: Create `backend/Dockerfile`**

```dockerfile
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# uv for fast, reproducible installs
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install dependencies first (better layer caching)
COPY pyproject.toml ./
RUN uv sync --no-dev

# App code
COPY app ./app

EXPOSE 8000
CMD ["uv", "run", "--no-dev", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Create `backend/.dockerignore`**

```
.venv/
__pycache__/
*.pyc
.env
.pytest_cache/
tests/
```

- [ ] **Step 3: Create `docker-compose.yml` at the repo root**

```yaml
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file:
      - ./backend/.env
    restart: unless-stopped
```

- [ ] **Step 4: Create `README.md` at the repo root**

```markdown
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
```

- [ ] **Step 5: Verify the container builds and serves**

Run:
```bash
cp backend/.env.example backend/.env   # set a real OPENAI_API_KEY inside
docker compose up --build backend
```
Expected: container builds; `curl http://localhost:8000/health` returns `{"status":"ok"}`.

- [ ] **Step 6: End-to-end smoke test against the real LLM (optional, needs a key)**

Run:
```bash
curl -s -X POST http://localhost:8000/api/summarize \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","title":"Test","content":"FastAPI is a modern Python web framework for building APIs quickly with type hints and automatic docs.","options":{"length":"short"}}' | python -m json.tool
```
Expected: JSON with a non-empty `summary`, the `model`, and `usage` token counts.

- [ ] **Step 7: Commit**

```bash
git add backend/Dockerfile backend/.dockerignore docker-compose.yml README.md
git commit -m "chore(backend): add Docker, compose, and README"
```

---

## Self-Review Notes (author checklist — verified)

- **Spec coverage:** §6 contract → Tasks 2–3; §8 security (key in env, CORS, rate limit, error shape) → Tasks 1,3,4; §7 task registry → Task 2 (`tasks/summarize.py` module shape); §11 backend testing → all tasks; §10 structure → Tasks 1–5; §9 error handling (content_too_large, upstream_error, invalid_request, rate_limited, internal) → Task 3–4.
- **Deferred by design:** streaming, auth, DB history (spec §1 non-goals, §8 caveat) — intentionally absent.
- **Type consistency:** `summarize_messages(messages, model) -> (text, usage_dict)` used identically in wrapper, route, and all mocks; `Usage(**usage)` matches the dict keys `prompt_tokens/completion_tokens/total_tokens`.
