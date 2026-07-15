import json

from openai import OpenAI, OpenAIError

from app.config import get_settings


class LLMError(Exception):
    """Raised when the OpenAI call fails."""


def classify_attribute(messages: list[dict], model: str, allowed_values: list[str]) -> list[str]:
    settings = get_settings()
    client = OpenAI(api_key=settings.openai_api_key)

    # Structured output: `classifications` is an array whose items are constrained
    # to the allowed values, so the model can return one, several, or none — but
    # never a value outside the vocabulary. An empty array means "nothing applies".
    schema = {
        "type": "object",
        "properties": {
            "classifications": {
                "type": "array",
                "items": {"type": "string", "enum": allowed_values},
                "uniqueItems": True,
            },
        },
        "required": ["classifications"],
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
        return []
    return [str(v) for v in values]
