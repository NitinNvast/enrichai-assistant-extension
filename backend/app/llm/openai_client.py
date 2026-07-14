import json

from openai import OpenAI, OpenAIError

from app.config import get_settings


class LLMError(Exception):
    """Raised when the OpenAI call fails."""


def classify_attribute(messages: list[dict], model: str, allowed_values: list[str]) -> str:
    settings = get_settings()
    client = OpenAI(api_key=settings.openai_api_key)

    # Structured output: constrain `classification` to the allowed values (plus
    # "" for "not confident") so the model cannot return prose or invented values.
    schema = {
        "type": "object",
        "properties": {
            "classification": {"type": "string", "enum": [*allowed_values, ""]},
        },
        "required": ["classification"],
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
    return str(data.get("classification", ""))
