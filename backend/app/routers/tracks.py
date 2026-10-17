"""Opportunity track router (pairing job and repository).

Reference: docs/PLAN-5H.md (§4 BE lane, Phase BE-1).
"""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from backend.app.agents.repo_scout import RepoScout
from backend.app.db import get_db
from backend.app.events import emit
from backend.app.github.client import GitHubAPIError
from backend.app.models import (
    AgentEventModel,
    AnalysisModel,
    ChangeSetModel,
    JobModel,
    RepoModel,
    ResumeModel,
    TrackModel,
)
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

    job_schema = None
    if t.job:
        from backend.app.schemas import JobDraft, Priority, RequirementIn, SourceType

        req_schemas = [
            RequirementIn(
                id=r.id,
                name=r.name,
                category=r.category,
                priority=Priority(r.priority),
                source_sentence=r.source_sentence,
                taxonomy_key=r.taxonomy_key,
                search_terms=r.search_terms or [],
                position=r.position,
            )
            for r in t.job.requirements
        ]
        job_schema = JobDraft(
            id=t.job.id,
            title=t.job.title,
            company=t.job.company,
            source_url=t.job.source_url,
            source_type=SourceType(t.job.source_type),
            source_detail=t.job.source_detail,
            raw_text=t.job.raw_text,
            requirements=req_schemas,
            confirmed=t.job.confirmed,
            created_at=t.job.created_at.isoformat() if t.job.created_at else None,
        )

    latest_analysis_row = (
        db.query(AnalysisModel)
        .filter(AnalysisModel.track_id == t.id)
        .order_by(AnalysisModel.started_at.desc())
        .first()
    )

    analysis_schema = None
    verified_assessments: list[VerifiedAssessment] = []

    if latest_analysis_row:
        from backend.app.schemas import (
            Analysis,
            AnalysisKind,
            AnalysisStatus,
            Evidence,
            Status,
            Strength,
            Trigger,
            VerifiedAssessment,
        )

        analysis_schema = Analysis(
            id=latest_analysis_row.id,
            track_id=latest_analysis_row.track_id,
            commit_sha=latest_analysis_row.commit_sha,
            commit_message=latest_analysis_row.commit_message,
            trigger=Trigger(latest_analysis_row.trigger),
            kind=AnalysisKind(latest_analysis_row.kind),
            status=AnalysisStatus(latest_analysis_row.status),
            files_analyzed_count=latest_analysis_row.files_analyzed_count,
            started_at=(
                latest_analysis_row.started_at.isoformat()
                if latest_analysis_row.started_at
                else None
            ),
            finished_at=(
                latest_analysis_row.finished_at.isoformat()
                if latest_analysis_row.finished_at
                else None
            ),
        )

        for a in latest_analysis_row.assessments:
            ev_list = [
                Evidence(
                    signal_id=e.signal_id,
                    detector=e.detector,
                    file_path=e.file_path,
                    line_start=e.line_start,
                    line_end=e.line_end,
                    blob_sha=e.blob_sha,
                    snippet=e.snippet,
                    reason=e.reason,
                    strength=Strength(e.strength),
                    verified_at_sha=e.verified_at_sha,
                )
                for e in a.evidence
            ]
            verified_assessments.append(
                VerifiedAssessment(
                    requirement_id=a.requirement_id,
                    status=Status(a.status),
                    strength=Strength(a.strength),
                    summary=a.summary,
                    limitation=a.limitation,
                    next_step=a.next_step,
                    carried_forward=a.carried_forward,
                    reassessed=a.reassessed,
                    ignored_signals=a.ignored_signals or [],
                    ai_used=a.ai_used,
                    evidence=ev_list,
                )
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
        job=job_schema,
        latest_analysis=analysis_schema,
        assessments=verified_assessments,
    )


@router.post("/{id}/check-now")
async def check_now(id: str, db: Annotated[Session, Depends(get_db)]) -> dict[str, str]:
    """Manually trigger immediate commit check and reassessment for a track."""
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

    from backend.app.agents.orchestrator import orchestrator

    repo = t.repo
    scout = RepoScout()
    try:
        latest_sha = await scout.resolve_default_branch_sha(repo.owner, repo.name)
    except Exception:
        latest_sha = t.last_seen_sha or "HEAD"

    if t.last_seen_sha and t.last_seen_sha != latest_sha:
        # Reassess on new SHA
        analysis = await orchestrator.run_reassessment(
            track_id=t.id,
            new_sha=latest_sha,
            changed_files=[],
            commit_message="Manual check-now trigger",
            db=db,
        )
    else:
        # Initial or up to date
        analysis = await orchestrator.run_initial_assessment(
            track_id=t.id,
            sha=latest_sha,
            db=db,
        )

    return {
        "status": "checked",
        "track_id": t.id,
        "sha": latest_sha,
        "analysis_id": analysis.id,
    }


@router.get("/{id}/diff")
async def get_track_diff(
    id: str,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    """Retrieve the latest diff/changeset for a track."""
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

    change_set = (
        db.query(ChangeSetModel)
        .join(AnalysisModel, ChangeSetModel.analysis_id == AnalysisModel.id)
        .filter(AnalysisModel.track_id == id)
        .order_by(AnalysisModel.started_at.desc())
        .first()
    )

    if change_set and change_set.impact_plan:
        return change_set.impact_plan

    # If no changeset yet, return a clean empty diff payload
    return {
        "from_sha": t.last_seen_sha or "",
        "to_sha": t.last_seen_sha or "",
        "commit_message": "No reassessments recorded yet",
        "files_changed": [],
        "items": [],
    }


@router.delete("/{id}")
async def delete_track(
    id: str,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    """Delete a track and its related analyses, assessments, and events."""
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

    analyses = db.query(AnalysisModel).filter(AnalysisModel.track_id == id).all()
    for a in analyses:
        db.delete(a)
    events = db.query(AgentEventModel).filter(AgentEventModel.track_id == id).all()
    for e in events:
        db.delete(e)

    db.delete(t)
    db.commit()
    return {"deleted": True, "id": id}


@router.delete("/user/data")
async def delete_user_data(
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    """Wipe all user tracks, analyses, jobs, and resumes per DATA_POLICY.md."""
    db.query(AgentEventModel).delete()
    db.query(AnalysisModel).delete()
    db.query(TrackModel).delete()
    db.query(JobModel).delete()
    db.query(ResumeModel).delete()
    db.commit()
    return {"deleted": True, "message": "All user data deleted"}
