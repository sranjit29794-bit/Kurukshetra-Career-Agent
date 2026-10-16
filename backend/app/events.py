import asyncio
from typing import AsyncGenerator, Dict, List, Optional
from backend.app.schemas import AgentEvent


class EventBus:
    """Minimal typed in-process publish/subscribe event bus for AgentEvents."""

    def __init__(self) -> None:
        self._subscribers: List[asyncio.Queue[AgentEvent]] = []
        self._lock = asyncio.Lock()

    async def subscribe(self, track_id: Optional[int] = None) -> AsyncGenerator[AgentEvent, None]:
        queue: asyncio.Queue[AgentEvent] = asyncio.Queue()
        async with self._lock:
            self._subscribers.append(queue)
        try:
            while True:
                event = await queue.get()
                if track_id is None or event.track_id == track_id:
                    yield event
        finally:
            async with self._lock:
                if queue in self._subscribers:
                    self._subscribers.remove(queue)

    async def emit(self, event: AgentEvent) -> None:
        async with self._lock:
            for queue in list(self._subscribers):
                try:
                    queue.put_nowait(event)
                except asyncio.QueueFull:
                    pass


# Global singleton event bus instance
event_bus = EventBus()
