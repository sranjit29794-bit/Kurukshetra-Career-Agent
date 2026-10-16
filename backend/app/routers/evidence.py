"""Evidence file retrieval router.

Reference: docs/BRAIN.md (§13, §14) and docs/PLAN-5H.md (Phase BE-1).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.models import EvidenceModel, FileCacheModel
from backend.app.schemas import EvidenceFile

router = APIRouter(prefix="/api/evidence", tags=["Evidence"])


@router.get("/{id}/file", response_model=EvidenceFile)
async def get_evidence_file(
    id: str,
    db: Annotated[Session, Depends(get_db)],
) -> EvidenceFile:
    """Retrieve full file content and highlighted line range for an evidence citation.

    Reads from file_cache at the commit/blob SHA preserved during analysis.
    """
    evidence = db.query(EvidenceModel).filter(EvidenceModel.id == id).first()

    if evidence:
        cached = (
            db.query(FileCacheModel)
            .filter(FileCacheModel.blob_sha == evidence.blob_sha)
            .first()
        )
        content = cached.content if cached else evidence.snippet
        return EvidenceFile(
            path=evidence.file_path,
            sha=evidence.blob_sha,
            content=content,
            line_start=evidence.line_start,
            line_end=evidence.line_end,
        )

    # Secondary lookup by direct blob SHA if citation ID is a blob_sha
    cached_direct = (
        db.query(FileCacheModel).filter(FileCacheModel.blob_sha == id).first()
    )
    if cached_direct:
        lines = cached_direct.content.splitlines()
        return EvidenceFile(
            path=cached_direct.path,
            sha=cached_direct.blob_sha,
            content=cached_direct.content,
            line_start=1,
            line_end=max(1, len(lines)),
        )

    return JSONResponse(
        status_code=404,
        content={
            "error": {
                "code": "EVIDENCE_NOT_FOUND",
                "message": f"Evidence file citation '{id}' not found in cache",
                "retryable": False,
            }
        },
    )  # type: ignore[return-value]
