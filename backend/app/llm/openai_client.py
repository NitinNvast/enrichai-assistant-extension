from openai import OpenAI, OpenAIError

from app.config import get_settings


class LLMError(Exception):
    """Raised when the OpenAI call fails."""


def summarize_messages(messages: list[dict], model: str) -> tuple[str, dict]:
    settings = get_settings()
    client = OpenAI(api_key=settings.openai_api_key)
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.3,
        )
    except OpenAIError as exc:  # network, auth, rate limit, etc.
        raise LLMError(str(exc)) from exc

    text = resp.choices[0].message.content or ""
    usage = {
        "prompt_tokens": getattr(resp.usage, "prompt_tokens", 0),
        "completion_tokens": getattr(resp.usage, "completion_tokens", 0),
        "total_tokens": getattr(resp.usage, "total_tokens", 0),
    }
    return text, usage
