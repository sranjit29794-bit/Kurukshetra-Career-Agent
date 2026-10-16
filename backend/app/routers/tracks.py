"""Opportunity track router (pairing job and repository).

Reference: docs/PLAN-5H.md (§4 BE lane, §5 R0).
"""

from fastapi import APIRouter

from backend.app.schemas import Track, TrackCreate

router = APIRouter(prefix="/api/tracks", tags=["Tracks"])


@router.post("", response_model=Track)
async def create_track(track_in: TrackCreate) -> Track:
    """Create a new track linking a job and a repository with optional resume_id.

    Contract stub for Phase R0; implementation lands in Phase BE-1.
    """
    raise NotImplementedError("Contract stub; implemented in Phase BE-1")
