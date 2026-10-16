import json
from typing import AsyncGenerator, List, Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.events import event_bus
from backend.app.models import AgentEvent as AgentEventModel, Analysis, Job, Track
from backend.app.schemas import AgentEventDetail, EventLevel

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("", response_model=List[AgentEventDetail])
def get_activity_feed(
    track_id: Optional[int] = Query(None, description="Optional track ID to filter events"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of events to return"),
    db: Session = Depends(get_db),
) -> List[AgentEventDetail]:
    """Retrieves real persisted agent execution events from the database.

    Events represent actual state transitions and deterministic actions performed by:
    - RepoScout (file scoping and boundary verification)
    - SkepticVerifier (AST signal verification)
    - EvidenceEngine (deterministic requirement evaluation)
    - ChangeSentinel (commit change detection and reassessment)
    """
    query = db.query(AgentEventModel)
    if track_id is not None:
        query = query.filter(AgentEventModel.track_id == track_id)

    db_events = query.order_by(AgentEventModel.ts.desc()).limit(limit).all()

    # Pre-fetch associated tracks, analyses, and jobs for rich context
    track_ids = {e.track_id for e in db_events if e.track_id}
    analysis_ids = {e.analysis_id for e in db_events if e.analysis_id}

    tracks_map = {t.id: t for t in db.query(Track).filter(Track.id.in_(track_ids)).all()} if track_ids else {}
    analyses_map = {a.id: a for a in db.query(Analysis).filter(Analysis.id.in_(analysis_ids)).all()} if analysis_ids else {}

    job_ids = {t.job_id for t in tracks_map.values() if t.job_id}
    jobs_map = {j.id: j for j in db.query(Job).filter(Job.id.in_(job_ids)).all()} if job_ids else {}

    results: List[AgentEventDetail] = []
    for ev in db_events:
        commit_sha = None
        if ev.analysis_id and ev.analysis_id in analyses_map:
            commit_sha = analyses_map[ev.analysis_id].commit_sha
        elif ev.track_id and ev.track_id in tracks_map:
            commit_sha = tracks_map[ev.track_id].last_seen_sha

        track_title = None
        repo_name = None
        if ev.track_id and ev.track_id in tracks_map:
            tr = tracks_map[ev.track_id]
            if tr.job_id and tr.job_id in jobs_map:
                track_title = jobs_map[tr.job_id].title
            if tr.repo:
                repo_name = f"{tr.repo.owner}/{tr.repo.name}"

        # Safe level parsing
        try:
            level_enum = EventLevel(ev.level)
        except Exception:
            level_enum = EventLevel.INFO

        results.append(
            AgentEventDetail(
                id=ev.id,
                track_id=ev.track_id,
                analysis_id=ev.analysis_id,
                agent=ev.agent,
                level=level_enum,
                message=ev.message,
                timestamp=ev.ts,
                commit_sha=commit_sha,
                track_title=track_title,
                repo_name=repo_name,
            )
        )

    return results


@router.get("/stream")
async def stream_agent_events(
    track_id: Optional[int] = Query(None, description="Optional track ID filter for live events")
) -> StreamingResponse:
    """Server-Sent Events (SSE) endpoint broadcasting live agent transitions as they occur."""

    async def event_generator() -> AsyncGenerator[str, None]:
        async for event in event_bus.subscribe(track_id=track_id):
            payload = json.dumps(
                {
                    "track_id": event.track_id,
                    "analysis_id": event.analysis_id,
                    "agent": event.agent,
                    "level": event.level.value if hasattr(event.level, "value") else str(event.level),
                    "message": event.message,
                    "timestamp": event.timestamp.isoformat(),
                }
            )
            yield f"data: {payload}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
