from fastapi import APIRouter, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import get_settings
from app.errors import AppError
from app.llm import openai_client
from app.llm.openai_client import LLMError
from app.schemas import SummarizeRequest, SummarizeResponse, Usage
from app.tasks.summarize import build_messages

router = APIRouter(prefix="/api")
limiter = Limiter(key_func=get_remote_address)


@router.post("/summarize", response_model=SummarizeResponse)
@limiter.limit(lambda: get_settings().rate_limit)
def summarize(request: Request, req: SummarizeRequest) -> SummarizeResponse:
    try:
        return _summarize(req)
    except AppError:
        raise
    except Exception:
        # Convert unexpected errors to AppError so the response is produced
        # by FastAPI's exception_handler machinery (inside CORSMiddleware)
        # rather than Starlette's low-level catch-all, which would otherwise
        # strip CORS headers from the response. The catch-all `Exception`
        # handler in app/errors.py remains as a backstop for errors raised
        # outside route handlers.
        raise AppError(500, "internal", "Something went wrong.")


def _summarize(req: SummarizeRequest) -> SummarizeResponse:
    settings = get_settings()

    # Defense-in-depth abuse ceiling (2x the soft budget).
    if len(req.content) > settings.max_content_chars * 2:
        raise AppError(413, "content_too_large", "Page content is too large to process.")

    content = req.content
    truncated = False
    if len(content) > settings.max_content_chars:
        content = content[: settings.max_content_chars]
        truncated = True

    messages = build_messages(req.title, str(req.url), content, req.options)

    try:
        text, usage = openai_client.summarize_messages(messages, settings.openai_model)
    except LLMError:
        raise AppError(502, "upstream_error", "The summarization service failed.")

    return SummarizeResponse(
        summary=text,
        model=settings.openai_model,
        usage=Usage(**usage),
        truncated=truncated,
    )
