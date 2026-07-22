import json

from app.llm import openai_client


class _FakeMessage:
    def __init__(self, content):
        self.content = content


class _FakeChoice:
    def __init__(self, content):
        self.message = _FakeMessage(content)


class _FakeResponse:
    def __init__(self, content):
        self.choices = [_FakeChoice(content)]


def _fake_client_returning(content):
    class _FakeClient:
        def __init__(self, *args, **kwargs):
            self.chat = self
            self.completions = self

        def create(self, **kwargs):
            schema = kwargs["response_format"]["json_schema"]["schema"]
            prop = schema["properties"]["classifications"]
            assert prop["type"] == "array"
            assert "Wide" in prop["items"]["enum"]
            return _FakeResponse(content)

    return _FakeClient


def test_classify_attribute_parses_list(monkeypatch):
    monkeypatch.setattr(
        openai_client,
        "OpenAI",
        _fake_client_returning(json.dumps({"classifications": ["Wide"], "explanation": "spec: Wide Fit"})),
    )
    result = openai_client.classify_attribute(
        [{"role": "user", "content": "x"}], "gpt-4o", ["Narrow", "Wide"]
    )
    assert result.classifications == ["Wide"]
    assert result.explanation == "spec: Wide Fit"


def test_classify_attribute_empty_list(monkeypatch):
    monkeypatch.setattr(
        openai_client,
        "OpenAI",
        _fake_client_returning(json.dumps({"classifications": [], "explanation": "nothing applies"})),
    )
    result = openai_client.classify_attribute(
        [{"role": "user", "content": "x"}], "gpt-4o", ["Narrow", "Wide"]
    )
    assert result.classifications == []
    assert result.explanation == "nothing applies"
