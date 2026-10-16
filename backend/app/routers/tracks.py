"""Opportunity track router (pairing job and repository).

Reference: docs/PLAN-5H.md (§4 BE lane, Phase BE-1).
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from backend.app.agents.repo_scout import RepoScout
from backend.app.db import get_db
from backend.app.events import emit
from backend.app.github.client import GitHubAPIError
from backend.app.models import JobModel, RepoModel, ResumeModel, TrackModel
from backend.app.schemas import Repo, Track, TrackCreate, WatcherMode

router = APIRouter(prefix="/api/tracks", tags=["Tracks"])


@router.post("", response_model=Track)
async def create_track(
    track_in: TrackCreate,
    db: Annotated[Session, Depends(get_db)],
) -> Track:
    """Create a new track linking a job and repository with optional resume_id.

    Stores the track and emits a 'track_created' event for the orchestrator.
    """
    job = db.query(JobModel).filter(JobModel.id == track_in.job_id).first()
    if not job:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "JOB_NOT_FOUND",
                    "message": f"Job description '{track_in.job_id}' not found",
                    "retryable": False,
                }
            },
        )  # type: ignore[return-value]

    if track_in.resume_id:
        resume = (
            db.query(ResumeModel).filter(ResumeModel.id == track_in.resume_id).first()
        )
        if not resume:
            return JSONResponse(
                status_code=404,
                content={
                    "error": {
                        "code": "RESUME_NOT_FOUND",
                        "message": f"Resume '{track_in.resume_id}' not found",
                        "retryable": False,
                    }
                },
            )  # type: ignore[return-value]

    scout = RepoScout()
    owner, name, branch_override = scout.parse_repo_url(track_in.repo_url)
    repo_id = f"{owner}/{name}"
    repo_row = db.query(RepoModel).filter(RepoModel.id == repo_id).first()

    if repo_row:
        default_branch = branch_override or repo_row.default_branch
    else:
        try:
            repo_data, owner, name, default_branch = await scout.validate_repo(
                track_in.repo_url
            )
        except GitHubAPIError as err:
            return JSONResponse(
                status_code=err.status_code,
                content=err.to_dict(),
            )  # type: ignore[return-value]

        repo_row = RepoModel(
            id=repo_id,
            owner=owner,
            name=name,
            default_branch=default_branch,
            html_url=repo_data.get("html_url") or f"https://github.com/{owner}/{name}",
            webhook_status="none",
        )
        db.add(repo_row)
        db.commit()
        db.refresh(repo_row)

    target_branch = track_in.branch or default_branch
    track_id = f"track_{uuid.uuid4().hex[:12]}"
    new_track = TrackModel(
        id=track_id,
        job_id=track_in.job_id,
        repo_id=repo_id,
        branch=target_branch,
        resume_id=track_in.resume_id,
        watcher_mode="polling",
    )
    db.add(new_track)
    db.commit()
    db.refresh(new_track)

    await emit(
        agent="Orchestrator",
        message=f"Track created for job {job.title} and repo {repo_id}",
        level="info",
        track_id=new_track.id,
    )

    repo_schema = Repo(
        id=repo_row.id,
        owner=repo_row.owner,
        name=repo_row.name,
        default_branch=repo_row.default_branch,
        html_url=repo_row.html_url,
        webhook_id=repo_row.webhook_id,
        webhook_status=repo_row.webhook_status,  # type: ignore[arg-type]
        created_at=repo_row.created_at.isoformat() if repo_row.created_at else None,
    )

    return Track(
        id=new_track.id,
        job_id=new_track.job_id,
        repo_id=new_track.repo_id,
        branch=new_track.branch,
        resume_id=new_track.resume_id,
        last_seen_sha=new_track.last_seen_sha,
        watcher_mode=WatcherMode(new_track.watcher_mode),
        created_at=new_track.created_at.isoformat() if new_track.created_at else None,
        repo=repo_schema,
    )


@router.get("", response_model=list[Track])
async def list_tracks(db: Annotated[Session, Depends(get_db)]) -> list[Track]:
    """List all tracked job-repository opportunities."""
    track_rows = db.query(TrackModel).all()
    results: list[Track] = []
    for t in track_rows:
        repo_schema = None
        if t.repo:
            repo_schema = Repo(
                id=t.repo.id,
                owner=t.repo.owner,
                name=t.repo.name,
                default_branch=t.repo.default_branch,
                html_url=t.repo.html_url,
                webhook_id=t.repo.webhook_id,
                webhook_status=t.repo.webhook_status,  # type: ignore[arg-type]
                created_at=(
                    t.repo.created_at.isoformat() if t.repo.created_at else None
                ),
            )

        results.append(
            Track(
                id=t.id,
                job_id=t.job_id,
                repo_id=t.repo_id,
                branch=t.branch,
                resume_id=t.resume_id,
                last_seen_sha=t.last_seen_sha,
                watcher_mode=WatcherMode(t.watcher_mode),
                created_at=t.created_at.isoformat() if t.created_at else None,
                repo=repo_schema,
            )
        )
    return results


@router.get("/{id}", response_model=Track)
async def get_track(id: str, db: Annotated[Session, Depends(get_db)]) -> Track:
    """Retrieve detailed track information by ID."""
    t = db.query(TrackModel).filter(TrackModel.id == id).first()
    if not t:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "TRACK_NOT_FOUND",
                    "message": f"Track '{id}' not found",
                    "retryable": False,
                }
            },
        )  # type: ignore[return-value]

    repo_schema = None
    if t.repo:
        repo_schema = Repo(
            id=t.repo.id,
            owner=t.repo.owner,
            name=t.repo.name,
            default_branch=t.repo.default_branch,
            html_url=t.repo.html_url,
            webhook_id=t.repo.webhook_id,
            webhook_status=t.repo.webhook_status,  # type: ignore[arg-type]
            created_at=t.repo.created_at.isoformat() if t.repo.created_at else None,
        )

    return Track(
        id=t.id,
        job_id=t.job_id,
        repo_id=t.repo_id,
        branch=t.branch,
        resume_id=t.resume_id,
        last_seen_sha=t.last_seen_sha,
        watcher_mode=WatcherMode(t.watcher_mode),
        created_at=t.created_at.isoformat() if t.created_at else None,
        repo=repo_schema,
    )
