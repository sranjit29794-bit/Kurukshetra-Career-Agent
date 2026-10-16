"""Server-Sent Events router for live agent feed and reassessment updates.

Reference: docs/BRAIN.md (§6.2, §16.3) and docs/PLAN-5H.md (§4).
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

from backend.app.events import event_bus

router = APIRouter(tags=["Events"])


@router.get("/api/events/stream")
async def stream_events(
    request: Request, track_id: str | None = None
) -> EventSourceResponse:
    """Stream real-time agent activity and reassessment updates."""

    async def event_generator() -> AsyncGenerator[dict[str, str], None]:
        queue = await event_bus.subscribe(track_id)
        try:
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
                    yield {"event": "ping", "data": "{}"}
        finally:
            await event_bus.unsubscribe(queue)

    return EventSourceResponse(event_generator())
