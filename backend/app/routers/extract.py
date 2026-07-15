import logging

from fastapi import APIRouter, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import get_settings
from app.errors import AppError
from app.llm import openai_client
from app.llm.openai_client import LLMError
from app.schemas import ExtractRequest, ExtractResponse
from app.tasks.extract import build_attribute_prompt

router = APIRouter(prefix="/api")
limiter = Limiter(key_func=get_remote_address)
logger = logging.getLogger(__name__)


def _match_allowed(value: str, allowed: list[str]) -> str:
    """Return the canonical allowed value matching `value` (case-insensitive), else ''."""
    needle = value.strip().lower()
    for candidate in allowed:
        if candidate.lower() == needle:
            return candidate
    return ""


def _match_allowed_many(values: list[str], allowed: list[str]) -> list[str]:
    """Canonicalize each value to its allowed spelling, drop non-matches and
    duplicates, and order the survivors by their position in `allowed`."""
    matched = {_match_allowed(v, allowed) for v in values}
    matched.discard("")
    return [candidate for candidate in allowed if candidate in matched]


@router.post("/extract", response_model=ExtractResponse)
@limiter.limit(lambda: get_settings().rate_limit)
def extract(request: Request, req: ExtractRequest) -> ExtractResponse:
    try:
        return _extract(req)
    except AppError:
        raise
    except Exception:
        raise AppError(500, "internal", "Something went wrong.")


def _extract(req: ExtractRequest) -> ExtractResponse:
    settings = get_settings()
    messages = build_attribute_prompt(req.attributeName, req.guidelines, req.product)
    try:
        raw = openai_client.classify_attribute(messages, settings.openai_model, req.guidelines.allowedValues)
    except LLMError as exc:
        logger.warning("classify_attribute failed (model=%s): %s", settings.openai_model, exc)
        raise AppError(502, "upstream_error", "The classification service failed.") from exc

    classifications = _match_allowed_many(raw, req.guidelines.allowedValues)
    return ExtractResponse(
        attribute=req.attributeName,
        classifications=classifications,
        model=settings.openai_model,
    )
