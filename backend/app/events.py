"""In-process pub/sub event bus for streaming agent activity and analysis status via SSE.

Reference: docs/BRAIN.md (§5, §6, §7.1, §13).
"""

from __future__ import annotations

import asyncio
import contextlib
from typing import Any


class EventBus:
    """Asynchronous in-memory pub/sub broker for SSE broadcasting."""

    def __init__(self) -> None:
        self._subscribers: set[tuple[asyncio.Queue[dict[str, Any]], str | None]] = set()
        self._lock = asyncio.Lock()

    async def subscribe(
        self, track_id: str | None = None
    ) -> asyncio.Queue[dict[str, Any]]:
        """Register a new listener queue optionally filtered by track_id."""
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=100)
        async with self._lock:
            self._subscribers.add((queue, track_id))
        return queue

    async def unsubscribe(self, queue: asyncio.Queue[dict[str, Any]]) -> None:
        """Deregister an active listener queue."""
        async with self._lock:
            self._subscribers = {
                (q, tid) for (q, tid) in self._subscribers if q is not queue
            }

    async def publish(
        self,
        event_type: str,
        data: dict[str, Any],
        track_id: str | None = None,
    ) -> None:
        """Broadcast an event payload to matching subscribers."""
        payload = {
            "event": event_type,
            "data": data,
            "track_id": track_id,
        }
        async with self._lock:
            subscribers = list(self._subscribers)

        for queue, filter_track_id in subscribers:
            if filter_track_id is None or filter_track_id == track_id:
                with contextlib.suppress(asyncio.QueueFull):
                    queue.put_nowait(payload)


event_bus = EventBus()


async def emit(
    agent: str,
    message: str,
    level: str = "info",
    track_id: str = "",
    analysis_id: str | None = None,
) -> None:
    """Convenience helper for agents to post events to the live Agent Activity feed."""
    event_data = {
        "agent": agent,
        "level": level,
        "message": message,
        "track_id": track_id,
        "analysis_id": analysis_id,
    }
    await event_bus.publish(
        "agent_event", event_data, track_id=track_id if track_id else None
    )
