"""GitHub user profile and candidate repositories router.

Reference: docs/PLAN-5H.md (§1.2 A4, §4 BE lane, §5 R0).
"""

from fastapi import APIRouter

from backend.app.schemas import RepoCandidate

router = APIRouter(prefix="/api/github/users", tags=["GitHub Users"])


@router.get("/{u}/repos", response_model=list[RepoCandidate])
async def get_user_repos(u: str) -> list[RepoCandidate]:
    """List public candidate repositories for a GitHub username.

    Contract stub for Phase R0; implementation lands in Phase BE-1.
    """
    raise NotImplementedError("Contract stub; implemented in Phase BE-1")
