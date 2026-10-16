"""Repository connection and management router.

Reference: docs/BRAIN.md (§13, §14) and docs/PLAN-5H.md (Phase BE-1).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from backend.app.agents.repo_scout import RepoScout
from backend.app.db import get_db
from backend.app.github.client import GitHubAPIError
from backend.app.models import RepoModel
from backend.app.schemas import Repo, RepoConnectRequest

router = APIRouter(prefix="/api/repos", tags=["Repositories"])


@router.post("/connect", response_model=Repo)
async def connect_repository(
    payload: RepoConnectRequest,
    db: Annotated[Session, Depends(get_db)],
) -> Repo:
    """Connect and validate a GitHub repository.

    Resolves default branch HEAD SHA, computes scope preview, and records
    or updates the repository row idempotently (repeated connect = one row).
    """
    scout = RepoScout()

    try:
        repo_data, owner, name, default_branch = await scout.validate_repo(
            payload.repo_url
        )
    except GitHubAPIError as err:
        return JSONResponse(
            status_code=err.status_code,
            content=err.to_dict(),
        )  # type: ignore[return-value]

    target_branch = payload.branch or default_branch

    try:
        snapshot = await scout.fetch_snapshot(
            repo_url=payload.repo_url,
            branch=target_branch,
            db_session=db,
        )
    except GitHubAPIError as err:
        return JSONResponse(
            status_code=err.status_code,
            content=err.to_dict(),
        )  # type: ignore[return-value]

    repo_id = f"{owner}/{name}"
    existing_repo = db.query(RepoModel).filter(RepoModel.id == repo_id).first()

    if existing_repo:
        existing_repo.default_branch = target_branch
        existing_repo.html_url = (
            repo_data.get("html_url") or f"https://github.com/{owner}/{name}"
        )
        db.commit()
        db.refresh(existing_repo)
        repo_row = existing_repo
    else:
        repo_row = RepoModel(
            id=repo_id,
            owner=owner,
            name=name,
            default_branch=target_branch,
            html_url=repo_data.get("html_url") or f"https://github.com/{owner}/{name}",
            webhook_status="none",
        )
        db.add(repo_row)
        db.commit()
        db.refresh(repo_row)

    return Repo(
        id=repo_row.id,
        owner=repo_row.owner,
        name=repo_row.name,
        default_branch=repo_row.default_branch,
        html_url=repo_row.html_url,
        head_sha=snapshot.commit_sha,
        scope=snapshot.scope,
        webhook_id=repo_row.webhook_id,
        webhook_status=repo_row.webhook_status,  # type: ignore[arg-type]
        created_at=repo_row.created_at.isoformat() if repo_row.created_at else None,
    )


@router.get("/{owner}/{name}", response_model=Repo)
async def get_repository(
    owner: str,
    name: str,
    db: Annotated[Session, Depends(get_db)],
) -> Repo:
    """Retrieve connected repository information by owner and name."""
    repo_id = f"{owner}/{name}"
    repo = db.query(RepoModel).filter(RepoModel.id == repo_id).first()
    if not repo:
        raise HTTPException(
            status_code=404,
            detail={
                "error": {
                    "code": "REPO_NOT_FOUND",
                    "message": f"Repository '{repo_id}' not found in database",
                    "retryable": False,
                }
            },
        )

    return Repo(
        id=repo.id,
        owner=repo.owner,
        name=repo.name,
        default_branch=repo.default_branch,
        html_url=repo.html_url,
        webhook_id=repo.webhook_id,
        webhook_status=repo.webhook_status,  # type: ignore[arg-type]
        created_at=repo.created_at.isoformat() if repo.created_at else None,
    )
