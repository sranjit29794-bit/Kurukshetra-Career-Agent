"""GitHub webhook reception and HMAC verification router.

Reference: docs/BRAIN.md (§6.1, §6.2, §14) and docs/PLAN-5H.md (Phase BE-2).
"""

from __future__ import annotations

import json
import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from backend.app.agents.change_sentinel import change_sentinel
from backend.app.db import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/webhooks", tags=["Webhooks"])


@router.post("/github")
async def handle_github_webhook(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    x_hub_signature_256: str | None = Header(None, alias="X-Hub-Signature-256"),
    x_github_delivery: str | None = Header(None, alias="X-GitHub-Delivery"),
    x_github_event: str | None = Header(None, alias="X-GitHub-Event"),
) -> dict[str, Any]:
    """Receive and verify signed GitHub webhooks (push, ping, check_run)."""
    raw_body = await request.body()

    # 1. Verify HMAC SHA-256 signature
    if not change_sentinel.verify_webhook_signature(raw_body, x_hub_signature_256):
        logger.warning(
            "Rejected webhook delivery %s: invalid HMAC signature", x_github_delivery
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "code": "invalid_signature",
                    "message": "HMAC signature verification failed",
                    "retryable": False,
                }
            },
        )

    # Parse JSON payload
    try:
        payload = json.loads(raw_body.decode("utf-8")) if raw_body else {}
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "invalid_json",
                    "message": str(err),
                    "retryable": False,
                }
            },
        ) from err

    event_name = x_github_event or "push"
    delivery_id = x_github_delivery or "unknown"
    sha = payload.get("after") or ""

    # 2. Delivery deduplication
    if delivery_id != "unknown" and change_sentinel.is_duplicate_delivery(
        delivery_id, event_name, db, sha
    ):
        return {
            "status": "ignored",
            "reason": "duplicate_delivery",
            "delivery_id": delivery_id,
        }

    # 3. Handle Ping event
    if event_name == "ping":
        return {
            "status": "pong",
            "zen": payload.get("zen", "Keep it logically awesome."),
            "hook_id": payload.get("hook_id"),
        }

    # 4. Handle Push event
    if event_name == "push":
        result = await change_sentinel.handle_push_payload(payload, db)
        return result

    # 5. Handle CI Check Run / Workflow Run event
    if event_name in ("check_run", "workflow_run"):
        result = await change_sentinel.handle_check_run_payload(payload, db)
        return result

    return {"status": "ignored", "reason": f"unhandled_event_{event_name}"}
