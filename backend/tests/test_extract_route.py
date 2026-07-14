import pytest
from fastapi.testclient import TestClient

from app.llm import openai_client
from app.main import app

client = TestClient(app)

VALID_BODY = {
    "attributeName": "Fit - Shoe Width",
    "guidelines": {"instructions": "Classify width.", "allowedValues": ["Narrow", "Standard", "Wide", "Extra Wide"]},
    "product": {"name": "Nike Pegasus", "description": "wide forefoot", "specifications": {"Fit": "Wide Fit"}},
    "context": {"projectId": "P", "catalogId": "C", "terminalNodeId": "N"},
}


@pytest.fixture(autouse=True)
def mock_llm(monkeypatch):
    monkeypatch.setattr(openai_client, "classify_attribute", lambda messages, model, allowed: "Wide")


def test_extract_success():
    resp = client.post("/api/extract", json=VALID_BODY)
    assert resp.status_code == 200
    data = resp.json()
    assert data["attribute"] == "Fit - Shoe Width"
    assert data["classification"] == "Wide"
    assert data["model"]


def test_extract_coerces_out_of_list_value(monkeypatch):
    monkeypatch.setattr(openai_client, "classify_attribute", lambda messages, model, allowed: "Enormous")
    resp = client.post("/api/extract", json=VALID_BODY)
    assert resp.status_code == 200
    assert resp.json()["classification"] == ""


def test_extract_matches_allowed_case_insensitively(monkeypatch):
    monkeypatch.setattr(openai_client, "classify_attribute", lambda messages, model, allowed: "wide")
    resp = client.post("/api/extract", json=VALID_BODY)
    assert resp.json()["classification"] == "Wide"  # canonical casing echoed


def test_extract_missing_attribute_is_invalid_request():
    body = {k: v for k, v in VALID_BODY.items() if k != "attributeName"}
    resp = client.post("/api/extract", json=body)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "invalid_request"


def test_extract_upstream_error(monkeypatch):
    def boom(messages, model, allowed):
        raise openai_client.LLMError("openai down")

    monkeypatch.setattr(openai_client, "classify_attribute", boom)
    resp = client.post("/api/extract", json=VALID_BODY)
    assert resp.status_code == 502
    assert resp.json()["error"]["code"] == "upstream_error"
