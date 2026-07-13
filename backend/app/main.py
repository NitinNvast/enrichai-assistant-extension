from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded

from app.config import get_settings
from app.errors import error_response, register_handlers
from app.routers import health, summarize
from app.routers.summarize import limiter


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="AI Summarizer Backend")

    app.state.limiter = limiter

    async def _rate_limit_handler(request, exc):
        return error_response(429, "rate_limited", "Too many requests. Please slow down.")

    app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origins_list,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    register_handlers(app)
    app.include_router(health.router)
    app.include_router(summarize.router)
    return app


app = create_app()
