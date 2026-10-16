"""Job ingestion and requirements extraction router.

Reference: docs/BRAIN.md (§9, §11, §12) and docs/PLAN-5H.md (Phase IN-2).
"""

from __future__ import annotations

import logging
import re
import uuid
from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from backend.app.agents.job_ingest import JobIngestError, LoginRequiredError, job_ingest
from backend.app.db import get_db
from backend.app.models import (
    AnalysisModel,
    JobModel,
    RequirementModel,
    TrackModel,
)
from backend.app.schemas import (
    ClaimsCell,
    ClaimsMatrix,
    ClaimsRepo,
    ClaimsRow,
    JobDraft,
    JobExtractNeedsPaste,
    Priority,
    RequirementIn,
    SourceType,
    Status,
    Strength,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/jobs", tags=["Jobs"])


class JobExtractRequest(BaseModel):
    """Payload to extract job requirements from a URL or raw text."""

    url: str | None = None
    raw_text: str | None = None
    title: str | None = None
    company: str | None = None


@router.post("/extract", response_model=JobDraft | JobExtractNeedsPaste)
async def extract_job_posting(
    payload: JobExtractRequest,
) -> JobDraft | JobExtractNeedsPaste:
    """Extract structured job requirements from a URL (Greenhouse, Lever) or pasted text."""
    if payload.raw_text and payload.raw_text.strip():
        text = payload.raw_text.strip()
        source_url = payload.url or ""
        if not source_url:
            source_match = re.search(r"Source:\s*(https?://\S+)", text, re.IGNORECASE)
            if source_match:
                source_url = source_match.group(1).strip()
            else:
                source_url = "pasted://job-description"

        # Guess title and company from first lines if not provided
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        title = payload.title or (lines[0] if lines else "Software Engineer Position")
        company = payload.company or "Company"
        if len(lines) > 1 and not payload.company and not lines[1].startswith("http"):
            # Check if second or third line looks like location/company
            company = lines[1].split("-")[0].strip()

        return job_ingest.extract_requirements(
            title=title,
            company=company,
            text_content=text,
            source_url=source_url,
            source_type=SourceType.user_provided,
            source_detail="User-provided job description",
        )

    if payload.url and payload.url.strip():
        url = payload.url.strip()
        try:
            title, company, clean_text, source_detail = await job_ingest.fetch_url(url)
            return job_ingest.extract_requirements(
                title=payload.title or title,
                company=payload.company or company,
                text_content=clean_text,
                source_url=url,
                source_type=SourceType.fetched,
                source_detail=source_detail,
            )
        except LoginRequiredError as exc:
            return JobExtractNeedsPaste(
                status="needs_paste",
                reason=exc.reason,
                source_url=exc.source_url,
            )
        except JobIngestError as exc:
            if exc.code == "LOGIN_WALL" or exc.status_code in (401, 403, 999):
                return JobExtractNeedsPaste(
                    status="needs_paste",
                    reason="login_required",
                    source_url=url,
                )
            raise

    raise JobIngestError(
        code="INVALID_INPUT",
        message="Must provide either 'url' or 'raw_text' in the request payload.",
        retryable=False,
        status_code=400,
    )


@router.post("", response_model=JobDraft)
def create_job(draft: JobDraft, db: Session = Depends(get_db)) -> JobDraft:
    """Save confirmed job description and its extracted requirements into the database."""
    job_id = draft.id or f"job_{uuid.uuid4().hex[:12]}"

    # Check if job already exists
    existing = db.execute(
        select(JobModel).where(JobModel.id == job_id)
    ).scalar_one_or_none()
    if existing:
        db.delete(existing)
        db.commit()

    job_model = JobModel(
        id=job_id,
        title=draft.title,
        company=draft.company,
        source_url=draft.source_url,
        source_type=draft.source_type.value,
        source_detail=draft.source_detail,
        raw_text=draft.raw_text,
        confirmed=True,
    )
    db.add(job_model)

    for idx, req in enumerate(draft.requirements):
        req_id = f"{job_id}_{req.taxonomy_key or idx}"
        req.id = req_id
        req_model = RequirementModel(
            id=req_id,
            job_id=job_id,
            name=req.name,
            category=req.category,
            priority=req.priority.value,
            source_sentence=req.source_sentence,
            search_terms=req.search_terms,
            taxonomy_key=req.taxonomy_key,
            position=idx + 1,
        )
        db.add(req_model)

    db.commit()

    draft.id = job_id
    draft.confirmed = True
    return draft


@router.get("", response_model=list[JobDraft])
def list_jobs(db: Session = Depends(get_db)) -> list[JobDraft]:
    """List all saved job postings."""
    jobs = (
        db.execute(select(JobModel).options(selectinload(JobModel.requirements)))
        .scalars()
        .all()
    )
    result: list[JobDraft] = []
    for job in jobs:
        reqs = [
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
            for r in job.requirements
        ]
        result.append(
            JobDraft(
                id=job.id,
                title=job.title,
                company=job.company,
                source_url=job.source_url,
                source_type=SourceType(job.source_type),
                source_detail=job.source_detail,
                raw_text=job.raw_text,
                requirements=reqs,
                confirmed=job.confirmed,
                created_at=job.created_at.isoformat() if job.created_at else None,
            )
        )
    return result


@router.get("/{id}", response_model=JobDraft)
def get_job(id: str, db: Session = Depends(get_db)) -> Any:
    """Retrieve details and requirements for a specific job."""
    job = db.execute(
        select(JobModel)
        .where(JobModel.id == id)
        .options(selectinload(JobModel.requirements))
    ).scalar_one_or_none()
    if not job:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "NOT_FOUND",
                    "message": f"Job posting '{id}' not found.",
                    "retryable": False,
                }
            },
        )

    reqs = [
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
        for r in job.requirements
    ]
    return JobDraft(
        id=job.id,
        title=job.title,
        company=job.company,
        source_url=job.source_url,
        source_type=SourceType(job.source_type),
        source_detail=job.source_detail,
        raw_text=job.raw_text,
        requirements=reqs,
        confirmed=job.confirmed,
        created_at=job.created_at.isoformat() if job.created_at else None,
    )


@router.get("/{id}/claims-matrix", response_model=ClaimsMatrix)
def get_job_claims_matrix(id: str, db: Session = Depends(get_db)) -> Any:
    """Return Claims Matrix comparing candidate resume claims against repo assessments."""
    job = db.execute(
        select(JobModel)
        .where(JobModel.id == id)
        .options(
            selectinload(JobModel.requirements),
            selectinload(JobModel.tracks).selectinload(TrackModel.repo),
            selectinload(JobModel.tracks).selectinload(TrackModel.resume),
        )
    ).scalar_one_or_none()
    if not job:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "NOT_FOUND",
                    "message": f"Job posting '{id}' not found.",
                    "retryable": False,
                }
            },
        )

    # 1. Gather repos / columns
    repos: list[ClaimsRepo] = []
    track_map: dict[str, TrackModel] = {}
    for track in job.tracks:
        track_map[track.id] = track
        full_name = (
            f"{track.repo.owner}/{track.repo.name}" if track.repo else track.repo_id
        )
        repos.append(
            ClaimsRepo(
                track_id=track.id,
                full_name=full_name,
                sha=track.last_seen_sha or "HEAD",
            )
        )

    # 2. Gather resume claims across tracks
    claimed_taxonomy_keys: dict[str, str | int] = {}
    for track in job.tracks:
        if track.resume and track.resume.claimed_skills:
            for claim in track.resume.claimed_skills:
                tax_key = claim.get("taxonomy_key") or claim.get("skill", "").lower()
                source_line = claim.get("source_line", 1)
                claimed_taxonomy_keys[tax_key] = source_line

    # 3. For each track, fetch latest analysis assessments
    track_assessments: dict[str, dict[str, tuple[Status, Strength]]] = {}
    for track_id in track_map:
        track_assessments[track_id] = {}
        latest_analysis = (
            db.execute(
                select(AnalysisModel)
                .where(AnalysisModel.track_id == track_id)
                .order_by(AnalysisModel.id.desc())
                .options(selectinload(AnalysisModel.assessments))
            )
            .scalars()
            .first()
        )
        if latest_analysis:
            for asmt in latest_analysis.assessments:
                track_assessments[track_id][asmt.requirement_id] = (
                    Status(asmt.status),
                    Strength(asmt.strength),
                )

    # 4. Build claims matrix rows
    rows: list[ClaimsRow] = []
    for req in job.requirements:
        # Check claim
        is_claimed = False
        claim_line: str | int | None = None

        if req.taxonomy_key and req.taxonomy_key in claimed_taxonomy_keys:
            is_claimed = True
            claim_line = claimed_taxonomy_keys[req.taxonomy_key]
        elif req.name.lower() in claimed_taxonomy_keys:
            is_claimed = True
            claim_line = claimed_taxonomy_keys[req.name.lower()]

        cells: list[ClaimsCell] = []
        for track_col in repos:
            asmt_info = track_assessments.get(track_col.track_id, {}).get(req.id)
            if asmt_info:
                status, strength = asmt_info
            else:
                status, strength = Status.NOT_DEMONSTRATED, Strength.none
            cells.append(
                ClaimsCell(
                    track_id=track_col.track_id,
                    status=status,
                    strength=strength,
                )
            )

        rows.append(
            ClaimsRow(
                requirement_id=req.id,
                name=req.name,
                claimed=is_claimed,
                claim_source_line=claim_line,
                cells=cells,
            )
        )

    return ClaimsMatrix(
        job_id=job.id,
        repos=repos,
        rows=rows,
    )
