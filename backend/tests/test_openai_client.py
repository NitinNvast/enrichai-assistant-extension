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


class _FakeClient:
    def __init__(self, *args, **kwargs):
        self.chat = self
        self.completions = self

    def create(self, **kwargs):
        # Echo the schema enum back so we can assert allowed values were wired in.
        schema = kwargs["response_format"]["json_schema"]["schema"]
        assert "Wide" in schema["properties"]["classification"]["enum"]
        return _FakeResponse(json.dumps({"classification": "Wide"}))


def test_classify_attribute_parses_classification(monkeypatch):
    monkeypatch.setattr(openai_client, "OpenAI", _FakeClient)
    result = openai_client.classify_attribute(
        [{"role": "user", "content": "x"}], "gpt-4o", ["Narrow", "Wide"]
    )
    assert result == "Wide"
