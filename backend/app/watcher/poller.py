"""Background Polling Watcher: Polls connected repositories for new commit SHAs

and triggers targeted reassessment when code changes are observed.
"""
import asyncio
import logging
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

from backend.app.config import get_settings
from backend.app.db import SessionLocal
from backend.app.evaluator.reassessment import process_new_commit
from backend.app.github.client import GitHubClient, RateLimitError
from backend.app.models import Repo, Track
from backend.app.schemas import Trigger

logger = logging.getLogger(__name__)


class PollingWatcher:
    """Bounded, rate-limit aware polling service."""

    def __init__(self):
        self._running = False
        self._task: Optional[asyncio.Task] = None

    def start(self):
        if not self._running:
            self._running = True
            self._task = asyncio.create_task(self._poll_loop())
            logger.info("PollingWatcher started.")

    def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            logger.info("PollingWatcher stopped.")

    async def _poll_loop(self):
        settings = get_settings()
        interval = settings.POLL_INTERVAL_S or 20

        while self._running:
            try:
                await self.poll_all_tracks()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"Error during polling round: {e}")

            await asyncio.sleep(interval)

    async def poll_all_tracks(self):
        """Polls all active tracks to check if the repository HEAD SHA has advanced."""
        db: Session = SessionLocal()
        client = GitHubClient()

        try:
            tracks = db.query(Track).all()
            for track in tracks:
                repo = db.query(Repo).filter_by(id=track.repo_id).first()
                if not repo:
                    continue

                try:
                    head_sha = await client.get_branch_head_sha(repo.owner, repo.name, track.branch)
                    if head_sha and head_sha != track.last_seen_sha and track.last_seen_sha:
                        logger.info(f"PollingWatcher: Detected new SHA {head_sha[:8]} on track #{track.id}")
                        await process_new_commit(
                            track_id=track.id,
                            new_sha=head_sha,
                            trigger=Trigger.POLL,
                            commit_message="Detected via periodic polling watcher",
                            db=db,
                        )
                    elif head_sha and not track.last_seen_sha:
                        track.last_seen_sha = head_sha
                        db.commit()
                except RateLimitError:
                    # Respect rate limits, don't spam errors
                    break
                except Exception as e:
                    logger.debug(f"Failed to poll track #{track.id}: {e}")
                    continue
        finally:
            db.close()

    async def check_track_now(self, track_id: int) -> bool:
        """Manual check triggered from the UI for testing or immediate recovery."""
        db: Session = SessionLocal()
        client = GitHubClient()
        detected_new = False

        try:
            track = db.query(Track).filter_by(id=track_id).first()
            if not track:
                return False

            repo = db.query(Repo).filter_by(id=track.repo_id).first()
            if not repo:
                return False

            head_sha = await client.get_branch_head_sha(repo.owner, repo.name, track.branch)
            if head_sha and head_sha != track.last_seen_sha and track.last_seen_sha:
                await process_new_commit(
                    track_id=track.id,
                    new_sha=head_sha,
                    trigger=Trigger.MANUAL,
                    commit_message="Detected via manual check action",
                    db=db,
                )
                detected_new = True
            elif head_sha and not track.last_seen_sha:
                track.last_seen_sha = head_sha
                db.commit()
        finally:
            db.close()

        return detected_new


# Global Polling Watcher instance
polling_watcher = PollingWatcher()
