"""GitHub user profile and candidate repositories router.

Reference: docs/PLAN-5H.md (§1.2 A4, §4 BE lane, Phase BE-1).
"""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from backend.app.github.client import GitHubAPIError, get_github_client
from backend.app.schemas import RepoCandidate, RepoCandidateKind, RepoCandidateSource

router = APIRouter(prefix="/api/github/users", tags=["GitHub Users"])


@router.get("/{u}/repos", response_model=list[RepoCandidate])
async def get_user_repos(u: str) -> list[RepoCandidate]:
    """List public candidate repositories for a GitHub username.

    Public, non-fork repos are prioritized first, sorted by recent activity (max 30).
    """
    client = get_github_client()
    try:
        raw_repos = await client.get_user_repos(u, max_repos=30)
    except GitHubAPIError as err:
        return JSONResponse(
            status_code=err.status_code,
            content=err.to_dict(),
        )  # type: ignore[return-value]

    candidates: list[RepoCandidate] = []
    for r in raw_repos:
        name = r.get("name", "")
        owner = r.get("owner", {}).get("login", u)
        html_url = r.get("html_url") or f"https://github.com/{owner}/{name}"
        candidates.append(
            RepoCandidate(
                url=html_url,
                owner=owner,
                name=name,
                kind=RepoCandidateKind.repo,
                source=RepoCandidateSource.text,
            )
        )

    return candidates
