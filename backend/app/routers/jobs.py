"""Jobs API router: extraction, requirement confirmation, and retrieval."""
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.jobs.extractor import analyze_job_text
from backend.app.jobs.fetcher import JobFetchError, fetch_job_page
from backend.app.models import Job, Requirement
from backend.app.schemas import (
    JobDraft,
    JobExtractRequest,
    JobUpdateRequest,
    RequirementDraft,
    SourceType,
)

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.post("/extract", response_model=JobDraft)
async def extract_job_requirements(
    request: JobExtractRequest,
    db: Session = Depends(get_db),
) -> JobDraft:
    """Extracts job requirements from either a public URL, pasted text, or both.

    Modes:
    1. Text only: parses pasted job description text.
    2. URL only: securely fetches and cleans HTML job posting.
    3. Combined (URL + Text): fetches URL and enriches with pasted text; if URL fetch fails,
       gracefully falls back to pasted text with an informative notice.
    - Supports user-specified target_role override.
    - Persists initial unconfirmed Job draft with canonical source URL and extraction timestamp.
    """
    raw_text = ""
    source_type = SourceType.USER_PROVIDED
    source_url = request.source_url or request.url
    input_mode = request.mode or "auto"
    ambiguity_notes: List[str] = []

    has_url = bool(request.url and request.url.strip())
    has_text = bool(request.text and len(request.text.strip()) >= 20)

    if has_url and has_text:
        # COMBINED MODE: Try URL first, enrich with pasted text, fallback cleanly if blocked
        try:
            fetched_html_text = await fetch_job_page(request.url.strip())
            raw_text = (
                f"--- SOURCE JOB POSTING (FROM URL: {request.url.strip()}) ---\n"
                f"{fetched_html_text}\n\n"
                f"--- SUPPLEMENTAL DESCRIPTION PROVIDED BY CANDIDATE ---\n"
                f"{request.text.strip()}"
            )
            source_type = SourceType.FETCHED
            source_url = request.url.strip()
            input_mode = "combined"
            ambiguity_notes.append("Combined analysis: Requirements consolidated from both public job URL and candidate-provided text.")
        except JobFetchError as e:
            # Graceful fallback to user's pasted text
            raw_text = request.text.strip()
            source_type = SourceType.USER_PROVIDED
            source_url = request.url.strip()
            input_mode = "combined_fallback"
            ambiguity_notes.append(
                f"URL import notice: Direct fetch encountered access limitations ({e.code}). DevProof successfully extracted requirements from your pasted job text."
            )
        except Exception:
            raw_text = request.text.strip()
            source_type = SourceType.USER_PROVIDED
            source_url = request.url.strip()
            input_mode = "combined_fallback"
            ambiguity_notes.append(
                "URL import notice: Direct fetch failed. DevProof successfully extracted requirements from your pasted job text."
            )
    elif has_url:
        # URL ONLY MODE
        input_mode = "url"
        try:
            raw_text = await fetch_job_page(request.url.strip())
            source_type = SourceType.FETCHED
            source_url = request.url.strip()
        except JobFetchError as e:
            raise HTTPException(
                status_code=400,
                detail={"error": {"code": e.code, "message": e.message, "retryable": e.retryable}},
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail={"error": {"code": "JOB_FETCH_FAILED", "message": str(e), "retryable": False}},
            )
    elif request.text and request.text.strip():
        # TEXT ONLY MODE
        input_mode = "text"
        raw_text = request.text.strip()
        if len(raw_text) < 20:
            raise HTTPException(
                status_code=422,
                detail={"error": {"code": "TEXT_TOO_SHORT", "message": "Pasted job text must be at least 20 characters long.", "retryable": False}},
            )
        source_type = SourceType.USER_PROVIDED
    else:
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "MISSING_INPUT", "message": "Please provide either a job URL, pasted description text, or both.", "retryable": False}},
        )

    # Run Job Analyst extraction
    extracted = await analyze_job_text(
        text=raw_text,
        source_url=source_url,
        source_type=source_type,
        target_role=request.target_role,
        ambiguity_notes=ambiguity_notes,
    )

    # Persist Job Draft in SQLite
    job = Job(
        title=extracted["title"],
        company=extracted["company"],
        source_url=extracted["source_url"],
        source_type=extracted["source_type"].value,
        raw_text=extracted["raw_text"],
        confirmed=False,
    )
    db.add(job)
    db.flush()

    req_drafts: List[RequirementDraft] = []
    for req_data in extracted["requirements"]:
        req = Requirement(
            job_id=job.id,
            name=req_data.name,
            category=req_data.category,
            priority=req_data.priority.value,
            source_sentence=req_data.source_sentence,
            taxonomy_key=req_data.taxonomy_key,
            search_terms=req_data.search_terms,
            position=req_data.position or 0,
        )
        db.add(req)
        db.flush()
        req_drafts.append(
            RequirementDraft(
                id=req.id,
                name=req.name,
                category=req.category,
                priority=req_data.priority,
                source_sentence=req.source_sentence,
                taxonomy_key=req.taxonomy_key,
                search_terms=req.search_terms or [],
                position=req.position,
            )
        )

    db.commit()
    db.refresh(job)

    return JobDraft(
        id=job.id,
        title=job.title,
        company=job.company,
        source_url=job.source_url,
        source_type=SourceType(job.source_type),
        raw_text=job.raw_text,
        confirmed=job.confirmed,
        requirements=req_drafts,
        ambiguities=extracted.get("ambiguities", []),
        extracted_at=job.created_at.isoformat() if job.created_at else None,
        input_mode=input_mode,
    )


@router.get("/{job_id}", response_model=JobDraft)
async def get_job(job_id: int, db: Session = Depends(get_db)) -> JobDraft:
    """Retrieves a persisted job draft and its requirements."""
    job = db.query(Job).filter_by(id=job_id).first()
    if not job:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "JOB_NOT_FOUND", "message": f"Job draft #{job_id} not found.", "retryable": False}},
        )

    reqs = (
        db.query(Requirement)
        .filter_by(job_id=job.id)
        .order_by(Requirement.position.asc(), Requirement.id.asc())
        .all()
    )

    req_drafts = [
        RequirementDraft(
            id=r.id,
            name=r.name,
            category=r.category,
            priority=r.priority,
            source_sentence=r.source_sentence,
            taxonomy_key=r.taxonomy_key,
            search_terms=r.search_terms or [],
            position=r.position,
        )
        for r in reqs
    ]

    return JobDraft(
        id=job.id,
        title=job.title,
        company=job.company,
        source_url=job.source_url,
        source_type=SourceType(job.source_type),
        raw_text=job.raw_text,
        confirmed=job.confirmed,
        requirements=req_drafts,
        ambiguities=[],
        extracted_at=job.created_at.isoformat() if job.created_at else None,
    )


@router.put("/{job_id}/confirm", response_model=JobDraft)
async def confirm_job_requirements(
    job_id: int,
    request: JobUpdateRequest,
    db: Session = Depends(get_db),
) -> JobDraft:
    """User review & confirmation endpoint: allows updating title, company, and
    the exact set of requirements (edits, deletions, additions). Sets confirmed=True.
    """
    job = db.query(Job).filter_by(id=job_id).first()
    if not job:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "JOB_NOT_FOUND", "message": f"Job #{job_id} not found.", "retryable": False}},
        )

    if not request.requirements:
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "NO_REQUIREMENTS", "message": "At least one confirmed requirement is required.", "retryable": False}},
        )

    job.title = request.title.strip() or job.title
    job.company = request.company.strip() or job.company
    job.confirmed = True

    # Delete existing requirements and replace with confirmed list
    db.query(Requirement).filter_by(job_id=job.id).delete()
    db.flush()

    new_req_drafts: List[RequirementDraft] = []
    for i, r in enumerate(request.requirements, 1):
        req = Requirement(
            job_id=job.id,
            name=r.name.strip(),
            category=r.category.strip(),
            priority=r.priority.value if hasattr(r.priority, "value") else str(r.priority),
            source_sentence=r.source_sentence.strip() or "User confirmed requirement",
            taxonomy_key=r.taxonomy_key,
            search_terms=r.search_terms or [],
            position=i,
        )
        db.add(req)
        db.flush()
        new_req_drafts.append(
            RequirementDraft(
                id=req.id,
                name=req.name,
                category=req.category,
                priority=req.priority,
                source_sentence=req.source_sentence,
                taxonomy_key=req.taxonomy_key,
                search_terms=req.search_terms or [],
                position=req.position,
            )
        )

    db.commit()
    db.refresh(job)

    return JobDraft(
        id=job.id,
        title=job.title,
        company=job.company,
        source_url=job.source_url,
        source_type=SourceType(job.source_type),
        raw_text=job.raw_text,
        confirmed=job.confirmed,
        requirements=new_req_drafts,
        ambiguities=[],
        extracted_at=job.created_at.isoformat() if job.created_at else None,
    )
