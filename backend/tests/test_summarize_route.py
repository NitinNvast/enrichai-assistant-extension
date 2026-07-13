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
