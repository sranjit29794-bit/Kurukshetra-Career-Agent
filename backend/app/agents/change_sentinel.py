"""Change Sentinel: handles GitHub webhooks, HMAC verification, deduplication, and polling.

Reference: docs/BRAIN.md (§6.1, §6.2, §14) and docs/PLAN-5H.md (Phase BE-2).

Hard Invariants:
1. Webhooks verified using constant-time HMAC-SHA256 comparison.
2. X-GitHub-Delivery deduplicated via webhook_deliveries table.
3. Branch filtering: pushes to non-tracked branches are ignored.
4. Ping events return pong cleanly.
5. Webhook and poller converge on the same orchestrator reassessment function.
6. Force-push triggers full reassessment.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.agents.orchestrator import orchestrator
from backend.app.config import settings
from backend.app.events import event_bus
from backend.app.models import RepoModel, TrackModel, WebhookDeliveryModel
from backend.app.schemas import Trigger

logger = logging.getLogger(__name__)


class ChangeSentinel:
    """Detects and processes repository changes from GitHub webhooks or background polling."""

    def verify_webhook_signature(
        self,
        payload_bytes: bytes,
        signature_header: str | None,
        secret: str | None = None,
    ) -> bool:
        """Verify HMAC-SHA256 signature from X-Hub-Signature-256 header using constant-time comparison."""
        if not signature_header:
            return False

        effective_secret = (
            secret if secret is not None else settings.GITHUB_WEBHOOK_SECRET
        )
        if not effective_secret:
            return False

        if not signature_header.startswith("sha256="):
            return False

        expected_sig = (
            "sha256="
            + hmac.new(
                key=effective_secret.encode("utf-8"),
                msg=payload_bytes,
                digestmod=hashlib.sha256,
            ).hexdigest()
        )

        return hmac.compare_digest(expected_sig, signature_header)

    def is_duplicate_delivery(
        self,
        delivery_id: str,
        event_name: str,
        db: Session,
        sha: str = "",
    ) -> bool:
        """Check if delivery ID has already been processed and record it if new."""
        existing = db.get(WebhookDeliveryModel, delivery_id)
        if existing:
            logger.info("Ignoring duplicate webhook delivery: %s", delivery_id)
            return True

        # Record delivery
        delivery = WebhookDeliveryModel(
            delivery_id=delivery_id,
            event=event_name,
            sha=sha,
            received_at=datetime.now(UTC),
            outcome="received",
        )
        db.add(delivery)
        db.commit()
        return False

    async def handle_push_payload(
        self,
        payload: dict[str, Any],
        db: Session,
    ) -> dict[str, Any]:
        """Process push event from GitHub webhook."""
        ref = payload.get("ref", "")
        branch = ref.split("/")[-1] if ref.startswith("refs/heads/") else ref

        after_sha = payload.get("after")
        if not after_sha or after_sha == "0000000000000000000000000000000000000000":
            # Branch deleted
            return {"status": "ignored", "reason": "branch_deleted"}

        repo_info = payload.get("repository", {})
        repo_html_url = repo_info.get("html_url", "")
        repo_owner = repo_info.get("owner", {}).get("name") or repo_info.get(
            "owner", {}
        ).get("login", "")
        repo_name = repo_info.get("name", "")

        head_commit = payload.get("head_commit") or {}
        commit_message = head_commit.get("message", "Commit pushed to GitHub")

        # Collect all changed files across commits in push
        changed_files_set: set[str] = set()
        for commit in payload.get("commits", []):
            changed_files_set.update(commit.get("added", []))
            changed_files_set.update(commit.get("modified", []))
            changed_files_set.update(commit.get("removed", []))

        # Include head_commit files if not captured
        if head_commit:
            changed_files_set.update(head_commit.get("added", []))
            changed_files_set.update(head_commit.get("modified", []))
            changed_files_set.update(head_commit.get("removed", []))

        changed_files = sorted(changed_files_set)

        # Force-push detection
        is_forced = bool(payload.get("forced", False))
        if is_forced:
            event_bus.emit(
                agent="ChangeSentinel",
                message=f"Force-push detected on {branch}@{after_sha[:7]}",
                level="warn",
            )

        # Find matching tracks by repository and branch
        stmt = (
            select(TrackModel)
            .join(RepoModel)
            .where(
                (RepoModel.html_url == repo_html_url)
                | ((RepoModel.owner == repo_owner) & (RepoModel.name == repo_name)),
                TrackModel.branch == branch,
            )
        )
        tracks = db.scalars(stmt).all()

        if not tracks:
            logger.info(
                "No active tracks found for repo %s/%s on branch %s",
                repo_owner,
                repo_name,
                branch,
            )
            return {"status": "ignored", "reason": "no_matching_tracks"}

        updated_tracks = []
        for track in tracks:
            track.watcher_mode = "webhook"
            analysis = await orchestrator.run_reassessment(
                track_id=track.id,
                new_sha=after_sha,
                changed_files=changed_files,
                commit_message=commit_message,
                db=db,
                trigger=Trigger.webhook,
            )
            updated_tracks.append(
                {
                    "track_id": track.id,
                    "analysis_id": analysis.id,
                    "status": analysis.status,
                }
            )

        return {
            "status": "processed",
            "tracks_updated": len(updated_tracks),
            "details": updated_tracks,
        }

    async def handle_check_run_payload(
        self,
        payload: dict[str, Any],
        db: Session,
    ) -> dict[str, Any]:
        """Process check_run or workflow_run completion event to upgrade Testing to CI-verified."""
        check_run = payload.get("check_run") or payload.get("workflow_run") or {}
        status = check_run.get("status")
        conclusion = check_run.get("conclusion")
        head_sha = check_run.get("head_sha") or check_run.get("head_commit", {}).get(
            "id"
        )

        if (
            status != "completed"
            or conclusion not in ("success", "neutral")
            or not head_sha
        ):
            return {"status": "ignored", "reason": "check_run_not_successful"}

        repo_info = payload.get("repository", {})
        repo_owner = repo_info.get("owner", {}).get("login", "")
        repo_name = repo_info.get("name", "")

        # Find tracks matching repo
        stmt = (
            select(TrackModel)
            .join(RepoModel)
            .where(
                RepoModel.owner == repo_owner,
                RepoModel.name == repo_name,
            )
        )
        tracks = db.scalars(stmt).all()

        upgraded_count = 0
        for track in tracks:
            if await orchestrator.upgrade_ci_testing(track.id, head_sha, db):
                upgraded_count += 1

        return {
            "status": "processed",
            "upgraded_tracks": upgraded_count,
            "head_sha": head_sha,
        }


change_sentinel = ChangeSentinel()
