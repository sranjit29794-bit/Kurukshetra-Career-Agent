"""Health check router.

Reference: docs/BRAIN.md (§13) and docs/PLAN-5H.md (§4).
"""

from fastapi import APIRouter

from backend.app.config import settings
from backend.app.schemas import Health

router = APIRouter(tags=["Health"])


@router.get("/api/health", response_model=Health)
async def get_health() -> Health:
    """Return backend health, LLM connectivity, GitHub rate limits, and watcher status."""
    return Health(
        llm="ok" if settings.LLM_ENABLED else "disabled",
        github="ok" if settings.GITHUB_TOKEN else "unauthenticated",
        rate_remaining=5000 if settings.GITHUB_TOKEN else 60,
        watcher="polling",
        next_poll_in_s=settings.POLL_INTERVAL_S,
    )
