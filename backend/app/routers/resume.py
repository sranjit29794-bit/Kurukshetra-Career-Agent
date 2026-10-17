"""Resume upload and claims extraction router.

Reference: docs/PLAN-5H.md (§1.2 A1, A3, §4 IN lane, §5 R0) and docs/BRAIN.md (§9, §11).
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.agents.resume_ingest import resume_ingest
from backend.app.db import get_db
from backend.app.models import ResumeModel
from backend.app.schemas import (
    RepoCandidate,
    RepoCandidateKind,
    RepoCandidateSource,
    ResumeClaim,
    ResumeClaimKind,
    ResumeDraft,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/resume", tags=["Resume"])

MAX_RESUME_SIZE = 10 * 1024 * 1024  # 10 MB max resume file size


class ResumeParseRequest(BaseModel):
    """Resume parse input payload supporting raw text or multipart metadata."""

    text: str | None = None
    filename: str = "pasted_resume.txt"


@router.post("/parse", response_model=ResumeDraft)
async def parse_resume(
    request: Request,
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
) -> Any:
    """Parse candidate resume from multipart file upload or text payload, extracting claims and candidate repos."""
    content_type = request.headers.get("content-type", "")

    if file is not None:
        file_bytes = await file.read()
        if len(file_bytes) > MAX_RESUME_SIZE:
            logger.warning("Resume file '%s' exceeds %d bytes limit (%d bytes)", file.filename, MAX_RESUME_SIZE, len(file_bytes))
            return JSONResponse(
                status_code=413,
                content={
                    "error": {
                        "code": "FILE_TOO_LARGE",
                        "message": "File exceeds 10MB limit.",
                        "retryable": False,
                    }
                },
            )
        if not file_bytes:
            logger.warning("Resume upload failed: uploaded file '%s' is empty (0 bytes)", file.filename)
            return JSONResponse(
                status_code=400,
                content={
                    "error": {
                        "code": "INVALID_INPUT",
                        "message": "Uploaded file is empty.",
                        "retryable": False,
                    }
                },
            )
        try:
            draft = resume_ingest.parse_pdf(
                file_bytes=file_bytes,
                filename=file.filename or "resume.pdf",
            )
        except ValueError as err:
            logger.warning("Invalid PDF '%s': %s", file.filename, err)
            return JSONResponse(
                status_code=400,
                content={
                    "error": {
                        "code": "INVALID_PDF",
                        "message": str(err),
                        "retryable": False,
                    }
                },
            )

    elif "application/json" in content_type:
        try:
            body = await request.json()
        except Exception:
            return JSONResponse(
                status_code=400,
                content={
                    "error": {
                        "code": "INVALID_INPUT",
                        "message": "Invalid JSON body.",
                        "retryable": False,
                    }
                },
            )
        text = body.get("text", "")
        if not text or not text.strip():
            return JSONResponse(
                status_code=400,
                content={
                    "error": {
                        "code": "INVALID_INPUT",
                        "message": "Missing or empty 'text' field in JSON request.",
                        "retryable": False,
                    }
                },
            )
        if len(text.encode("utf-8")) > MAX_RESUME_SIZE:
            return JSONResponse(
                status_code=413,
                content={
                    "error": {
                        "code": "FILE_TOO_LARGE",
                        "message": "Resume text exceeds 10MB limit.",
                        "retryable": False,
                    }
                },
            )
        draft = resume_ingest.parse_text(
            text=text,
            filename=body.get("filename", "pasted_resume.txt"),
        )

    else:
        # Check raw body (e.g. direct application/pdf binary)
        raw_bytes = await request.body()
        if len(raw_bytes) > MAX_RESUME_SIZE:
            return JSONResponse(
                status_code=413,
                content={
                    "error": {
                        "code": "FILE_TOO_LARGE",
                        "message": "Payload exceeds 10MB limit.",
                        "retryable": False,
                    }
                },
            )
        if raw_bytes.startswith(b"%PDF"):
            try:
                draft = resume_ingest.parse_pdf(
                    file_bytes=raw_bytes,
                    filename="resume.pdf",
                )
            except ValueError as err:
                return JSONResponse(
                    status_code=400,
                    content={
                        "error": {
                            "code": "INVALID_PDF",
                            "message": str(err),
                            "retryable": False,
                        }
                    },
                )
        elif raw_bytes:
            draft = resume_ingest.parse_text(
                text=raw_bytes.decode("utf-8", errors="ignore"),
                filename="pasted_resume.txt",
            )
        else:
            return JSONResponse(
                status_code=400,
                content={
                    "error": {
                        "code": "INVALID_INPUT",
                        "message": "Must provide a PDF file or text content.",
                        "retryable": False,
                    }
                },
            )

    # Persist parsed resume into SQLite
    # DATA POLICY: Store ONLY extracted claims and repo candidates - NEVER the PDF binary or raw text
    resume_model = ResumeModel(
        id=draft.resume_id,
        filename=draft.filename,
        extracted_text="",
        claimed_skills=[c.model_dump() for c in draft.claimed_skills],
        repo_candidates=[r.model_dump() for r in draft.repo_candidates],
    )
    db.add(resume_model)
    db.commit()

    return draft


@router.get("/{id}", response_model=ResumeDraft)
def get_resume(id: str, db: Session = Depends(get_db)) -> Any:
    """Retrieve details and claims for a previously parsed resume."""
    resume = db.execute(
        select(ResumeModel).where(ResumeModel.id == id)
    ).scalar_one_or_none()
    if not resume:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "NOT_FOUND",
                    "message": f"Resume '{id}' not found.",
                    "retryable": False,
                }
            },
        )

    claimed = [
        ResumeClaim(
            skill=c.get("skill", ""),
            taxonomy_key=c.get("taxonomy_key"),
            source_line=c.get("source_line", 1),
            kind=ResumeClaimKind(c.get("kind", "explicit")),
        )
        for c in resume.claimed_skills
    ]

    repos = [
        RepoCandidate(
            url=r.get("url", ""),
            owner=r.get("owner", ""),
            name=r.get("name"),
            kind=RepoCandidateKind(r.get("kind", "repo")),
            source=RepoCandidateSource(r.get("source", "text")),
        )
        for r in resume.repo_candidates
    ]

    return ResumeDraft(
        resume_id=resume.id,
        filename=resume.filename,
        text_chars=len(resume.extracted_text or ""),
        claimed_skills=claimed,
        repo_candidates=repos,
        warnings=[],
    )
