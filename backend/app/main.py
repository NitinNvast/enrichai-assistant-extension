from fastapi import FastAPI

from app.routers import health


def create_app() -> FastAPI:
    app = FastAPI(title="AI Summarizer Backend")
    app.include_router(health.router)
    return app


app = create_app()
