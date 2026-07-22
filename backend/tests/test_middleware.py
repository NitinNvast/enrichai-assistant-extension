import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.llm import openai_client
from app.main import app
from app.routers import extract as extract_router

client = TestClient(app)

BODY = {
    "attributeName": "Fit - Shoe Width",
    "guidelines": {"instructions": "Classify width.", "allowedValues": ["Narrow", "Standard", "Wide", "Extra Wide"]},
    "product": {"name": "Nike Pegasus", "description": "wide forefoot", "specifications": {"Fit": "Wide Fit"}},
    "context": {"projectId": "P", "catalogId": "C", "terminalNodeId": "N"},
}


@pytest.fixture(autouse=True)
def mock_classify(monkeypatch):
    monkeypatch.setattr(
        openai_client, "classify_attribute", lambda messages, model, allowed: (["Wide"], "spec says Wide Fit")
    )


def test_cors_header_present_for_allowed_origin():
    resp = client.post("/api/extract", json=BODY, headers={"Origin": "http://localhost:5173"})
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") is not None


def test_rate_limited_response_has_code_and_no_cors_needed(monkeypatch):
    """Exceeding the configured rate limit returns 429 rate_limited."""
    real_settings = get_settings()
    low_limit_settings = real_settings.model_copy(update={"rate_limit": "1/minute"})
    monkeypatch.setattr(extract_router, "get_settings", lambda: low_limit_settings)

    # Ensure a clean bucket for this test regardless of prior requests made
    # by other tests against the same TestClient IP.
    extract_router.limiter.reset()

    first = client.post("/api/extract", json=BODY, headers={"Origin": "http://localhost:5173"})
    assert first.status_code == 200

    second = client.post("/api/extract", json=BODY, headers={"Origin": "http://localhost:5173"})
    assert second.status_code == 429
    assert second.json()["error"]["code"] == "rate_limited"

    # Reset again so this test doesn't poison the shared in-memory bucket
    # for tests that run after it.
    extract_router.limiter.reset()


def test_unexpected_error_is_internal_and_has_cors_header(monkeypatch):
    """A bare, unexpected exception from the route becomes a 500 'internal'
    error and still carries CORS headers (see errors.py catch-all handler
    vs. the AppError conversion in routers/extract.py)."""

    def boom(messages, model, allowed):
        raise RuntimeError("unexpected failure")

    monkeypatch.setattr(openai_client, "classify_attribute", boom)

    no_raise_client = TestClient(app, raise_server_exceptions=False)
    resp = no_raise_client.post(
        "/api/extract", json=BODY, headers={"Origin": "http://localhost:5173"}
    )

    assert resp.status_code == 500
    assert resp.json()["error"]["code"] == "internal"
    assert resp.headers.get("access-control-allow-origin") is not None
