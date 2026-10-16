"""FastAPI application entry point for DevProof.

Reference: docs/BRAIN.md (§6, §7.1, §13).
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from backend.app.config import settings
from backend.app.db import init_db
from backend.app.events import event_bus
from backend.app.schemas import ErrorDetail, ErrorEnvelope, Health


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager to initialize DB and manage background tasks."""
    # Initialize SQLite database schemas
    init_db()
    yield
    # Teardown logic (e.g. background watcher cancellation) will live here


app = FastAPI(
    title="DevProof API",
    description="Evidence-backed career assessment & real-time repository reassessment engine",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", response_model=Health, tags=["Health"])
async def get_health() -> Health:
    """Return backend health, LLM connectivity, GitHub rate limits, and watcher status."""
    return Health(
        llm="ok" if settings.LLM_ENABLED else "disabled",
        github="ok" if settings.GITHUB_TOKEN else "unauthenticated",
        rate_remaining=5000 if settings.GITHUB_TOKEN else 60,
        watcher="polling",
        next_poll_in_s=settings.POLL_INTERVAL_S,
    )


@app.get("/api/events/stream", tags=["Events"])
async def stream_events(
    request: Request, track_id: str | None = None
) -> EventSourceResponse:
    """Server-Sent Events endpoint streaming real-time agent activity and reassessment updates."""

    async def event_generator() -> AsyncGenerator[dict[str, str], None]:
        queue = await event_bus.subscribe(track_id)
        try:
            # Send initial handshake
            yield {
                "event": "connected",
                "data": json.dumps({"status": "connected", "track_id": track_id}),
            }
            while True:
                if await request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield {
                        "event": msg["event"],
                        "data": json.dumps(msg["data"]),
                    }
                except TimeoutError:
                    # Keep-alive heartbeat comment
                    yield {"event": "ping", "data": "{}"}
        finally:
            await event_bus.unsubscribe(queue)

    return EventSourceResponse(event_generator())


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Fallback exception handler ensuring consistent ErrorEnvelope format per BRAIN §13."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorEnvelope(
            error=ErrorDetail(
                code="INTERNAL_SERVER_ERROR",
                message=str(exc) or "An unexpected server error occurred",
                retryable=True,
            )
        ).model_dump(),
    )
