import json
from typing import NamedTuple

from openai import OpenAI, OpenAIError

from app.config import get_settings


class LLMError(Exception):
    """Raised when the OpenAI call fails."""


class ClassificationResult(NamedTuple):
    classifications: list[str]
    explanation: str


def classify_attribute(
    messages: list[dict], model: str, allowed_values: list[str]
) -> ClassificationResult:
    settings = get_settings()
    client = OpenAI(api_key=settings.openai_api_key)

    # Structured output: `classifications` is an array whose items are constrained
    # to the allowed values, so the model can return one, several, or none — but
    # never a value outside the vocabulary. An empty array means "nothing applies".
    # NOTE: no `uniqueItems` — OpenAI strict structured outputs reject it. The
    # route dedupes downstream (`_match_allowed_many`), so it isn't needed here.
    schema = {
        "type": "object",
        "properties": {
            "classifications": {
                "type": "array",
                "items": {"type": "string", "enum": allowed_values},
            },
            "explanation": {"type": "string"},
        },
        "required": ["classifications", "explanation"],
        "additionalProperties": False,
    }

    try:
        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0,
            response_format={
                "type": "json_schema",
                "json_schema": {"name": "attribute_classification", "schema": schema, "strict": True},
            },
        )
    except OpenAIError as exc:
        raise LLMError(str(exc)) from exc

    content = resp.choices[0].message.content or "{}"
    try:
        data = json.loads(content)
    except json.JSONDecodeError as exc:
        raise LLMError(f"invalid JSON from model: {content!r}") from exc
    values = data.get("classifications", [])
    if not isinstance(values, list):
        values = []
    explanation = data.get("explanation", "")
    if not isinstance(explanation, str):
        explanation = ""
    return ClassificationResult([str(v) for v in values], explanation)
