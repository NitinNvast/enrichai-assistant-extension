from fastapi import FastAPI

from app.errors import register_handlers
from app.routers import health, summarize


def create_app() -> FastAPI:
    app = FastAPI(title="AI Summarizer Backend")
    register_handlers(app)
    app.include_router(health.router)
    app.include_router(summarize.router)
    return app


app = create_app()
