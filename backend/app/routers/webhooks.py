"""GitHub Push Webhook Router: Secure HMAC SHA-256 signature verification,

delivery deduplication, and triggering real targeted reassessments.
"""
import hashlib
import hmac
import json
from datetime import datetime
from typing import Any, Dict
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from backend.app.config import get_settings
from backend.app.db import get_db
from backend.app.evaluator.reassessment import process_new_commit
from backend.app.models import Repo, Track, WebhookDelivery
from backend.app.schemas import Trigger

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


def verify_github_signature(payload_bytes: bytes, signature_header: str, secret: str) -> bool:
    """Verifies HMAC SHA-256 signature using constant-time comparison."""
    if not signature_header or not signature_header.startswith("sha256="):
        return False

    expected_sig = "sha256=" + hmac.new(
        secret.encode("utf-8"),
        payload_bytes,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(expected_sig, signature_header)


@router.post("/github")
async def github_webhook(
    request: Request,
    x_github_event: str = Header(..., alias="X-GitHub-Event"),
    x_hub_signature_256: str = Header(None, alias="X-Hub-Signature-256"),
    x_github_delivery: str = Header(None, alias="X-GitHub-Delivery"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Ingests GitHub push webhook events:

    1. Validates HMAC SHA-256 signature against server GITHUB_WEBHOOK_SECRET
    2. Deduplicates delivery using X-GitHub-Delivery header
    3. Matches repository and branch to registered persistent Track
    4. Triggers targeted reassessment on new commit SHA
    """
    settings = get_settings()
    raw_body = await request.body()

    # 1. Signature Verification
    if settings.GITHUB_WEBHOOK_SECRET and settings.GITHUB_WEBHOOK_SECRET != "change-me":
        if not x_hub_signature_256:
            raise HTTPException(
                status_code=401,
                detail={"error": {"code": "MISSING_SIGNATURE", "message": "X-Hub-Signature-256 header is required.", "retryable": False}},
            )
        if not verify_github_signature(raw_body, x_hub_signature_256, settings.GITHUB_WEBHOOK_SECRET):
            raise HTTPException(
                status_code=401,
                detail={"error": {"code": "INVALID_SIGNATURE", "message": "HMAC SHA-256 signature mismatch.", "retryable": False}},
            )

    # Parse payload
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception:
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "MALFORMED_JSON", "message": "Could not parse webhook payload as JSON.", "retryable": False}},
        )

    # 2. Check event type (only process push)
    if x_github_event != "push":
        return {"status": "ignored", "reason": f"Event '{x_github_event}' is not a push event."}

    # Extract commit details
    ref = payload.get("ref", "")
    branch = ref.split("/")[-1] if "/" in ref else ref
    after_sha = payload.get("after")

    if not after_sha or after_sha == "0" * 40:
        return {"status": "ignored", "reason": "Branch deletion or zero SHA."}

    repository = payload.get("repository", {})
    repo_full_name = repository.get("full_name", "")
    owner = repository.get("owner", {}).get("login") or (repo_full_name.split("/")[0] if "/" in repo_full_name else "")
    repo_name = repository.get("name") or (repo_full_name.split("/")[1] if "/" in repo_full_name else "")

    # 3. Deduplication check via delivery ID
    delivery_id = x_github_delivery or f"push_{after_sha}"
    existing_delivery = db.query(WebhookDelivery).filter_by(delivery_id=delivery_id).first()
    if existing_delivery:
        return {"status": "duplicate", "delivery_id": delivery_id, "message": "Delivery already processed."}

    # Record delivery
    delivery = WebhookDelivery(
        delivery_id=delivery_id,
        event=x_github_event,
        sha=after_sha,
        received_at=datetime.utcnow(),
        outcome="processing",
    )
    db.add(delivery)
    db.commit()

    # 4. Find matching track for this repo and branch
    repo = db.query(Repo).filter_by(owner=owner, name=repo_name).first()
    if not repo:
        delivery.outcome = "untracked_repo"
        db.commit()
        return {"status": "ignored", "reason": f"Repository '{owner}/{repo_name}' is not tracked in DevProof."}

    tracks = db.query(Track).filter_by(repo_id=repo.id, branch=branch).all()
    if not tracks:
        # Fallback to default branch
        tracks = db.query(Track).filter_by(repo_id=repo.id).all()

    if not tracks:
        delivery.outcome = "untracked_branch"
        db.commit()
        return {"status": "ignored", "reason": f"No active track found for branch '{branch}'."}

    commit_msg = payload.get("head_commit", {}).get("message")

    # 5. Execute targeted reassessment for all tracks monitoring this repository
    last_result = None
    processed_track_ids = []
    for track in tracks:
        result = await process_new_commit(
            track_id=track.id,
            new_sha=after_sha,
            trigger=Trigger.WEBHOOK,
            commit_message=commit_msg,
            db=db,
        )
        if result:
            last_result = result
        processed_track_ids.append(track.id)

    delivery.outcome = "reassessed" if last_result else "reassessment_error"
    db.commit()

    return {
        "status": "processed",
        "track_ids": processed_track_ids,
        "track_id": processed_track_ids[-1] if processed_track_ids else None,
        "commit_sha": after_sha,
        "analysis_id": last_result.id if last_result else None,
    }
