import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.llm import openai_client
from app.main import app
from app.routers import summarize as summarize_router

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


def test_rate_limited_response_has_code_and_no_cors_needed(monkeypatch):
    """Exceeding the configured rate limit returns 429 rate_limited."""
    real_settings = get_settings()
    low_limit_settings = real_settings.model_copy(update={"rate_limit": "1/minute"})
    monkeypatch.setattr(summarize_router, "get_settings", lambda: low_limit_settings)

    # Ensure a clean bucket for this test regardless of prior requests made
    # by other tests against the same TestClient IP.
    summarize_router.limiter.reset()

    first = client.post("/api/summarize", json=BODY, headers={"Origin": "http://localhost:5173"})
    assert first.status_code == 200

    second = client.post("/api/summarize", json=BODY, headers={"Origin": "http://localhost:5173"})
    assert second.status_code == 429
    assert second.json()["error"]["code"] == "rate_limited"

    # Reset again so this test doesn't poison the shared in-memory bucket
    # for tests that run after it.
    summarize_router.limiter.reset()


def test_unexpected_error_is_internal_and_has_cors_header(monkeypatch):
    """A bare, unexpected exception from the route becomes a 500 'internal'
    error and still carries CORS headers (see errors.py catch-all handler
    vs. the AppError conversion in routers/summarize.py)."""

    def boom(messages, model):
        raise RuntimeError("unexpected failure")

    monkeypatch.setattr(openai_client, "summarize_messages", boom)

    no_raise_client = TestClient(app, raise_server_exceptions=False)
    resp = no_raise_client.post(
        "/api/summarize", json=BODY, headers={"Origin": "http://localhost:5173"}
    )

    assert resp.status_code == 500
    assert resp.json()["error"]["code"] == "internal"
    assert resp.headers.get("access-control-allow-origin") is not None
