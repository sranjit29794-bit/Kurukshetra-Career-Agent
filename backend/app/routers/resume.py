"""Resume upload and claims extraction router.

Reference: docs/PLAN-5H.md (§1.2 A1, A3, §4 IN lane, §5 R0) and docs/BRAIN.md (§9, §11).
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, Request
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


class ResumeParseRequest(BaseModel):
    """Resume parse input payload supporting raw text or multipart metadata."""

    text: str | None = None
    filename: str = "pasted_resume.txt"


def _extract_file_from_multipart(body: bytes, content_type: str) -> tuple[bytes, str]:
    """Extract file payload and filename from multipart request using Python standard library."""
    import re
    from email import message_from_bytes

    header_bytes = f"Content-Type: {content_type}\r\n\r\n".encode("latin-1")
    msg = message_from_bytes(header_bytes + body)
    for part in msg.walk():
        fn = part.get_filename()
        if fn:
            payload = part.get_payload(decode=True)
            if payload:
                return payload, fn

    fn = "resume.pdf"
    fn_match = re.search(r'filename="([^"]+)"', body.decode("latin-1", errors="ignore"))
    if fn_match:
        fn = fn_match.group(1)

    pdf_start = body.find(b"%PDF")
    if pdf_start != -1:
        boundary_idx = body.rfind(b"\r\n--")
        if boundary_idx > pdf_start:
            return body[pdf_start:boundary_idx], fn
        return body[pdf_start:], fn

    return b"", fn


@router.post("/parse", response_model=ResumeDraft)
async def parse_resume(
    request: Request,
    db: Session = Depends(get_db),
) -> Any:
    """Parse candidate resume from multipart file upload or text payload, extracting claims and candidate repos."""
    content_type = request.headers.get("content-type", "")

    if "multipart/form-data" in content_type:
        raw_body = await request.body()
        file_bytes, filename = _extract_file_from_multipart(raw_body, content_type)
        if not file_bytes:
            return JSONResponse(
                status_code=400,
                content={
                    "error": {
                        "code": "INVALID_INPUT",
                        "message": "Missing or empty file in multipart upload.",
                        "retryable": False,
                    }
                },
            )
        draft = resume_ingest.parse_pdf(file_bytes=file_bytes, filename=filename)

    elif "application/json" in content_type:
        body = await request.json()
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
        draft = resume_ingest.parse_text(
            text=text,
            filename=body.get("filename", "pasted_resume.txt"),
        )

    else:
        # Check raw body (e.g. direct application/pdf binary)
        raw_bytes = await request.body()
        if raw_bytes.startswith(b"%PDF"):
            draft = resume_ingest.parse_pdf(file_bytes=raw_bytes, filename="resume.pdf")
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
