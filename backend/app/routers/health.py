"""Health check router.

Reference: docs/BRAIN.md (§13) and docs/PLAN-5H.md (Phase BE-1).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.db import get_db
from backend.app.github.client import get_github_client
from backend.app.models import WebhookDeliveryModel
from backend.app.schemas import Health

router = APIRouter(tags=["Health"])


@router.get("/api/health", response_model=Health)
async def get_health(db: Annotated[Session, Depends(get_db)]) -> Health:
    """Return backend health, LLM connectivity, GitHub rate limits, and watcher status.

    Watcher honesty (A9): watcher displays 'webhook' ONLY after a real webhook delivery
    has been recorded in the database; otherwise 'polling'.
    """
    github_client = get_github_client()
    rate_rem = github_client.rate_remaining

    if not github_client.token:
        github_status = "unauthenticated"
    elif github_client.should_pause_polling():
        github_status = "rate_limited"
    else:
        github_status = "ok"

    watcher_mode = "polling"
    try:
        delivery_count = db.query(WebhookDeliveryModel).count()
        if delivery_count > 0:
            watcher_mode = "webhook"
    except SQLAlchemyError:
        watcher_mode = "polling"

    return Health(
        llm="ok" if settings.LLM_ENABLED else "disabled",
        github=github_status,
        rate_remaining=rate_rem,
        watcher=watcher_mode,
        next_poll_in_s=settings.POLL_INTERVAL_S,
    )
