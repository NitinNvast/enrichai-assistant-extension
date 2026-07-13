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
