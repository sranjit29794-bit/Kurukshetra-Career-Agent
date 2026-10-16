from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.github.client import (
    EmptyRepoError,
    GitHubClient,
    GitHubError,
    InvalidRepoUrlError,
    RateLimitError,
    RepoNotFoundError,
)
from backend.app.models import FileCache, Repo
from backend.app.schemas import RepoConnectRequest, RepoConnectResult

router = APIRouter(prefix="/api/repos", tags=["repos"])


@router.post("/connect", response_model=RepoConnectResult)
async def connect_repository(
    request: RepoConnectRequest,
    db: Session = Depends(get_db),
) -> RepoConnectResult:
    """Validates and connects a public GitHub repository.

    Resolves repository metadata, default branch, exact HEAD commit SHA,
    and computes the analyzable scope without executing any repository code.
    """
    client = GitHubClient()

    try:
        result, analyzable_files = await client.connect_repository(
            repo_url=request.repo_url,
            branch=request.branch,
        )

        # Upsert into database to track connected repo
        repo = db.query(Repo).filter_by(owner=result.owner, name=result.name).first()
        if not repo:
            repo = Repo(
                owner=result.owner,
                name=result.name,
                default_branch=result.default_branch,
                html_url=result.html_url,
                webhook_status=result.webhook_status.value,
            )
            db.add(repo)
        else:
            repo.default_branch = result.default_branch
            repo.html_url = result.html_url

        db.commit()
        db.refresh(repo)

        # Attach database record ID
        result.id = repo.id
        return result

    except InvalidRepoUrlError as e:
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": e.code, "message": e.message, "retryable": False}},
        )
    except RepoNotFoundError as e:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": e.code, "message": e.message, "retryable": False}},
        )
    except RateLimitError as e:
        err_detail: Dict[str, Any] = {
            "code": e.code,
            "message": e.message,
            "retryable": True,
        }
        if e.reset_epoch is not None:
            err_detail["reset_epoch"] = e.reset_epoch
        raise HTTPException(
            status_code=429,
            detail={"error": err_detail},
        )
    except EmptyRepoError as e:
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": e.code, "message": e.message, "retryable": False}},
        )
    except GitHubError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail={"error": {"code": e.code, "message": e.message, "retryable": e.retryable}},
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": {"code": "REPO_CONNECT_FAILED", "message": str(e), "retryable": False}},
        )


@router.get("/blob")
async def get_blob(
    owner: str = Query(..., description="Repository owner"),
    repo: str = Query(..., description="Repository name"),
    blob_sha: str = Query(..., description="Git blob SHA"),
    path: str = Query("", description="Original relative file path"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Fetches and caches file blob content pinned to an exact blob SHA.

    Static inspection only; never executes repository code.
    """
    # 1. Check local database cache first
    cached = db.query(FileCache).filter_by(blob_sha=blob_sha).first()
    if cached:
        return {
            "blob_sha": cached.blob_sha,
            "path": cached.path,
            "content": cached.content,
            "cached": True,
        }

    # 2. Fetch from GitHub REST API
    client = GitHubClient()
    try:
        content = await client.get_blob_content(owner, repo, blob_sha)

        # Store in cache
        new_cache = FileCache(blob_sha=blob_sha, path=path, content=content)
        db.merge(new_cache)
        db.commit()

        return {
            "blob_sha": blob_sha,
            "path": path,
            "content": content,
            "cached": False,
        }
    except GitHubError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail={"error": {"code": e.code, "message": e.message, "retryable": e.retryable}},
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": {"code": "BLOB_FETCH_FAILED", "message": str(e), "retryable": False}},
        )
