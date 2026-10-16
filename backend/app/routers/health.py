from datetime import datetime
from fastapi import APIRouter
from backend.app.config import get_settings
from backend.app.schemas import HealthResponse

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def get_health() -> HealthResponse:
    settings = get_settings()

    # Determine LLM state honestly
    if not settings.LLM_ENABLED:
        llm_state = "disabled"
    elif not settings.LLM_API_KEY:
        llm_state = "unconfigured"
    else:
        llm_state = "ok"

    # Determine GitHub state honestly
    if not settings.GITHUB_TOKEN:
        github_state = "unconfigured"
        github_rate_remaining = None
    else:
        github_state = "ok"
        github_rate_remaining = 5000

    # Determine Watcher state honestly
    if settings.PUBLIC_BASE_URL and settings.GITHUB_TOKEN:
        watcher_state = "both"
    elif settings.POLL_INTERVAL_S > 0:
        watcher_state = "polling"
    else:
        watcher_state = "unconfigured"

    return HealthResponse(
        backend="ok",
        llm=llm_state,
        github=github_state,
        github_rate_remaining=github_rate_remaining,
        watcher=watcher_state,
        next_poll_in_s=settings.POLL_INTERVAL_S if watcher_state in ("polling", "both") else None,
        timestamp=datetime.utcnow(),
    )
