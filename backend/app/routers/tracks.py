"""Tracks API router: create and retrieve persistent Job-Repo tracks."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.models import Analysis, Assessment as AssessmentModel, Evidence as EvidenceModel, FileCache, Job, Repo, Requirement, Track
from backend.app.schemas import (
    AnalysisDetail,
    AnalysisKind,
    AnalysisStatus,
    Assessment,
    AssessmentStatus,
    AssessmentStrength,
    DiffChange,
    DiffItem,
    DiffResponse,
    EvidenceItem,
    JobDraft,
    RepoConnectResult,
    RequirementDraft,
    Scope,
    SignalStrength,
    SourceType,
    TrackCreateRequest,
    TrackDetail,
    TrackSummary,
    Trigger,
    WatcherMode,
    WebhookStatus,
)
from backend.app.github.client import GitHubClient
from backend.app.detectors.runner import run_all_detectors
from backend.app.verifier.skeptic import SkepticVerifier
from backend.app.evaluator.engine import AssessmentEngine
from datetime import datetime

router = APIRouter(prefix="/api/tracks", tags=["tracks"])


def _build_job_draft(job: Job, reqs: List[Requirement]) -> JobDraft:
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
    )


def _build_repo_result(repo: Repo, head_sha: Optional[str]) -> RepoConnectResult:
    return RepoConnectResult(
        id=repo.id,
        owner=repo.owner,
        name=repo.name,
        html_url=repo.html_url,
        default_branch=repo.default_branch,
        head_sha=head_sha or "0000000000000000000000000000000000000000",
        scope=Scope(analyzed=0, skipped=0, skipped_reasons={}, truncated=False),
        webhook_status=WebhookStatus(repo.webhook_status) if repo.webhook_status in [s.value for s in WebhookStatus] else WebhookStatus.NONE,
        webhook_id=repo.webhook_id,
    )


@router.post("", response_model=TrackDetail)
async def create_track(
    request: TrackCreateRequest,
    db: Session = Depends(get_db),
) -> TrackDetail:
    """Creates a persistent career track linking a confirmed Job to a verified

    GitHub Repository at a specific branch and pinned commit SHA.
    """
    # 1. Validate Job exists and is confirmed
    job = db.query(Job).filter_by(id=request.job_id).first()
    if not job:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "JOB_NOT_FOUND", "message": f"Job #{request.job_id} not found.", "retryable": False}},
        )

    # 2. Validate Repo exists
    repo = db.query(Repo).filter_by(id=request.repo_id).first()
    if not repo:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "REPO_NOT_FOUND", "message": f"Repository #{request.repo_id} not found.", "retryable": False}},
        )

    branch = request.branch or repo.default_branch or "main"

    # 3. Check for existing track between this job and repo
    existing_track = db.query(Track).filter_by(job_id=job.id, repo_id=repo.id, branch=branch).first()
    if existing_track:
        if request.head_sha:
            existing_track.last_seen_sha = request.head_sha
            db.commit()
            db.refresh(existing_track)
        track = existing_track
    else:
        track = Track(
            job_id=job.id,
            repo_id=repo.id,
            branch=branch,
            last_seen_sha=request.head_sha,
            watcher_mode="polling",
        )
        db.add(track)
        db.commit()
        db.refresh(track)

    reqs = db.query(Requirement).filter_by(job_id=job.id).order_by(Requirement.position.asc()).all()
    job_draft = _build_job_draft(job, reqs)
    repo_result = _build_repo_result(repo, track.last_seen_sha)

    return TrackDetail(
        id=track.id,
        job_id=track.job_id,
        repo_id=track.repo_id,
        branch=track.branch,
        last_seen_sha=track.last_seen_sha,
        watcher_mode=WatcherMode(track.watcher_mode),
        created_at=track.created_at,
        job=job_draft,
        repo=repo_result,
    )


@router.get("", response_model=List[TrackSummary])
async def list_tracks(db: Session = Depends(get_db)) -> List[TrackSummary]:
    """Lists all persisted tracks."""
    tracks = db.query(Track).order_by(Track.created_at.desc()).all()
    return [
        TrackSummary(
            id=t.id,
            job_id=t.job_id,
            repo_id=t.repo_id,
            branch=t.branch,
            last_seen_sha=t.last_seen_sha,
            watcher_mode=WatcherMode(t.watcher_mode),
            created_at=t.created_at,
        )
        for t in tracks
    ]


@router.get("/{track_id}", response_model=TrackDetail)
async def get_track(track_id: int, db: Session = Depends(get_db)) -> TrackDetail:
    """Retrieves full details of a single track with its job and repo."""
    track = db.query(Track).filter_by(id=track_id).first()
    if not track:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "TRACK_NOT_FOUND", "message": f"Track #{track_id} not found.", "retryable": False}},
        )

    job = db.query(Job).filter_by(id=track.job_id).first()
    repo = db.query(Repo).filter_by(id=track.repo_id).first()
    reqs = db.query(Requirement).filter_by(job_id=job.id).order_by(Requirement.position.asc()).all()

    job_draft = _build_job_draft(job, reqs)
    repo_result = _build_repo_result(repo, track.last_seen_sha)

    return TrackDetail(
        id=track.id,
        job_id=track.job_id,
        repo_id=track.repo_id,
        branch=track.branch,
        last_seen_sha=track.last_seen_sha,
        watcher_mode=WatcherMode(track.watcher_mode),
        created_at=track.created_at,
        job=job_draft,
        repo=repo_result,
    )


def _serialize_analysis(analysis: Analysis, assessments: List[AssessmentModel]) -> AnalysisDetail:
    assessment_schemas: List[Assessment] = []
    for a in assessments:
        evidence_schemas = [
            EvidenceItem(
                id=e.id,
                signal_id=e.signal_id,
                detector=e.detector,
                file_path=e.file_path,
                line_start=e.line_start,
                line_end=e.line_end,
                snippet=e.snippet,
                blob_sha=e.blob_sha,
                strength=SignalStrength(e.strength),
                counted=e.counted,
            )
            for e in a.evidence
        ]
        assessment_schemas.append(
            Assessment(
                id=a.id,
                analysis_id=a.analysis_id,
                requirement_id=a.requirement_id,
                requirement_name=a.requirement.name if a.requirement else f"Requirement #{a.requirement_id}",
                status=AssessmentStatus(a.status),
                strength=AssessmentStrength(a.strength),
                summary=a.summary,
                limitation=a.limitation,
                next_step=a.next_step,
                carried_forward=a.carried_forward,
                reassessed=a.reassessed,
                ignored_signals=a.ignored_signals or [],
                ai_used=a.ai_used,
                evidence=evidence_schemas,
            )
        )

    return AnalysisDetail(
        id=analysis.id,
        track_id=analysis.track_id,
        commit_sha=analysis.commit_sha,
        commit_message=analysis.commit_message,
        trigger=Trigger(analysis.trigger),
        kind=AnalysisKind(analysis.kind),
        status=AnalysisStatus(analysis.status),
        prev_analysis_id=analysis.prev_analysis_id,
        scope=analysis.scope,
        ai_used=analysis.ai_used,
        error=analysis.error,
        started_at=analysis.started_at,
        finished_at=analysis.finished_at,
        assessments=assessment_schemas,
    )


@router.post("/{track_id}/analyze", response_model=AnalysisDetail)
async def analyze_track(track_id: int, db: Session = Depends(get_db)) -> AnalysisDetail:
    """Executes Phase 3 real assessment on the target repository at pinned commit SHA:

    1. Resolves track, confirmed job requirements, and linked repository
    2. Enforces idempotency on (track_id, commit_sha)
    3. Fetches analyzable file tree and blob contents pinned at exact commit SHA
    4. Runs deterministic detectors across Python backend scope
    5. Skeptic Verifier independently checks line spans and content matching
    6. AssessmentEngine maps verified evidence to confirmed requirements
    7. Persists analysis, assessments, and verified evidence to database
    """
    track = db.query(Track).filter_by(id=track_id).first()
    if not track:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "TRACK_NOT_FOUND", "message": f"Track #{track_id} not found.", "retryable": False}},
        )

    repo = db.query(Repo).filter_by(id=track.repo_id).first()
    job = db.query(Job).filter_by(id=track.job_id).first()
    reqs = db.query(Requirement).filter_by(job_id=job.id).order_by(Requirement.position.asc()).all()

    if not reqs:
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "NO_REQUIREMENTS", "message": "Track job has no requirements to evaluate.", "retryable": False}},
        )

    # Resolve commit SHA to analyze (pinned last_seen_sha, or latest branch HEAD)
    client = GitHubClient()
    commit_sha = track.last_seen_sha
    if not commit_sha or commit_sha == "0" * 40:
        try:
            commit_sha = await client.get_branch_head_sha(repo.owner, repo.name, track.branch)
            track.last_seen_sha = commit_sha
            db.commit()
            db.refresh(track)
        except Exception as e:
            raise HTTPException(
                status_code=502,
                detail={"error": {"code": "SHA_RESOLUTION_FAILED", "message": f"Could not resolve HEAD SHA for repository: {str(e)}", "retryable": True}},
            )

    # Idempotency check: (track_id, commit_sha)
    existing_analysis = db.query(Analysis).filter_by(track_id=track.id, commit_sha=commit_sha).first()
    if existing_analysis and existing_analysis.status == "complete":
        assessments = db.query(AssessmentModel).filter_by(analysis_id=existing_analysis.id).all()
        return _serialize_analysis(existing_analysis, assessments)

    # Initialize new Analysis record
    analysis = Analysis(
        track_id=track.id,
        commit_sha=commit_sha,
        trigger="manual",
        kind="initial",
        status="running",
        started_at=datetime.utcnow(),
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    try:
        # 1. Fetch Git tree at exact commit SHA
        tree_entries, truncated = await client.get_tree(repo.owner, repo.name, commit_sha)
        from backend.app.github.files import filter_tree_files
        analyzable_files, scope = filter_tree_files(tree_entries, truncated=truncated)

        # 2. Fetch file contents for analyzable files (bounded, cached)
        files_map = {}
        for f in analyzable_files:
            file_path = f["path"]
            blob_sha = f.get("sha", "")
            # Check local file cache
            cached = db.query(FileCache).filter_by(blob_sha=blob_sha).first()
            if cached:
                files_map[file_path] = cached.content
            else:
                try:
                    content = await client.get_blob_content(repo.owner, repo.name, blob_sha)
                    db.merge(FileCache(blob_sha=blob_sha, path=file_path, content=content))
                    files_map[file_path] = content
                except Exception:
                    # Individual file fetch failure: record limitation without breaking whole run
                    continue
        db.commit()

        # 3. Run deterministic detectors
        detected_signals = []
        for file_path, content in files_map.items():
            f_entry = next((e for e in analyzable_files if e["path"] == file_path), {})
            blob_sha = f_entry.get("sha", "")
            signals = run_all_detectors(file_path, content, blob_sha)
            detected_signals.extend(signals)

        # 4. Skeptic Verifier independent verification
        verified_evidence, dropped = SkepticVerifier.verify_all(detected_signals, files_map)

        # 5. Map verified evidence to confirmed requirements
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
        computed_assessments = AssessmentEngine.evaluate_all(req_drafts, verified_evidence)

        # 6. Persist assessments and evidence
        persisted_assessments = []
        for ca in computed_assessments:
            asm = AssessmentModel(
                analysis_id=analysis.id,
                requirement_id=ca.requirement_id,
                status=ca.status.value,
                strength=ca.strength.value,
                summary=ca.summary,
                limitation=ca.limitation,
                next_step=ca.next_step,
                carried_forward=False,
                reassessed=True,
                ai_used=False,
            )
            db.add(asm)
            db.flush()

            for ev in ca.evidence:
                ev_model = EvidenceModel(
                    assessment_id=asm.id,
                    signal_id=ev.signal_id,
                    detector=ev.detector,
                    file_path=ev.file_path,
                    line_start=ev.line_start,
                    line_end=ev.line_end,
                    snippet=ev.snippet,
                    blob_sha=ev.blob_sha,
                    strength=ev.strength.value,
                    counted=ev.counted,
                )
                db.add(ev_model)

            persisted_assessments.append(asm)

        analysis.status = "complete"
        analysis.scope = scope.model_dump()
        analysis.finished_at = datetime.utcnow()
        db.commit()
        db.refresh(analysis)

        return _serialize_analysis(analysis, persisted_assessments)

    except Exception as e:
        analysis.status = "failed"
        analysis.error = str(e)
        analysis.finished_at = datetime.utcnow()
        db.commit()
        raise HTTPException(
            status_code=500,
            detail={"error": {"code": "ANALYSIS_FAILED", "message": f"Assessment analysis failed: {str(e)}", "retryable": False}},
        )


@router.get("/{track_id}/history", response_model=List[AnalysisDetail])
async def get_track_history(track_id: int, db: Session = Depends(get_db)) -> List[AnalysisDetail]:
    """Retrieves full immutable assessment analysis history for a track."""
    track = db.query(Track).filter_by(id=track_id).first()
    if not track:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "TRACK_NOT_FOUND", "message": f"Track #{track_id} not found.", "retryable": False}},
        )

    analyses = (
        db.query(Analysis)
        .filter_by(track_id=track.id)
        .order_by(Analysis.started_at.desc())
        .all()
    )

    results = []
    for a in analyses:
        assessments = db.query(AssessmentModel).filter_by(analysis_id=a.id).all()
        results.append(_serialize_analysis(a, assessments))

    return results


@router.get("/{track_id}/diff", response_model=Optional[DiffResponse])
async def get_track_diff(track_id: int, db: Session = Depends(get_db)) -> Optional[DiffResponse]:
    """Computes before/after comparison between the latest two completed analyses."""
    track = db.query(Track).filter_by(id=track_id).first()
    if not track:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "TRACK_NOT_FOUND", "message": f"Track #{track_id} not found.", "retryable": False}},
        )

    analyses = (
        db.query(Analysis)
        .filter_by(track_id=track.id, status="complete")
        .order_by(Analysis.started_at.desc())
        .limit(2)
        .all()
    )

    if len(analyses) < 2:
        return None

    latest, previous = analyses[0], analyses[1]
    latest_asms = db.query(AssessmentModel).filter_by(analysis_id=latest.id).all()
    prev_asms = {a.requirement_id: a for a in db.query(AssessmentModel).filter_by(analysis_id=previous.id).all()}

    items: List[DiffItem] = []
    reassessed_count = 0
    carried_count = 0

    for curr in latest_asms:
        req_id = curr.requirement_id
        prev = prev_asms.get(req_id)
        before_status = AssessmentStatus(prev.status) if prev else None
        after_status = AssessmentStatus(curr.status)

        if curr.carried_forward:
            carried_count += 1
            change = DiffChange.UNCHANGED
        elif before_status is None:
            change = DiffChange.NEWLY_ASSESSED
            reassessed_count += 1
        elif before_status == after_status:
            change = DiffChange.UNCHANGED
            reassessed_count += 1
        elif (before_status == AssessmentStatus.NOT_DEMONSTRATED and after_status in (AssessmentStatus.PARTIAL, AssessmentStatus.DEMONSTRATED)) or (before_status == AssessmentStatus.PARTIAL and after_status == AssessmentStatus.DEMONSTRATED):
            change = DiffChange.IMPROVED
            reassessed_count += 1
        else:
            change = DiffChange.REGRESSED
            reassessed_count += 1

        curr_evidence = [
            EvidenceItem(
                id=e.id,
                signal_id=e.signal_id,
                detector=e.detector,
                file_path=e.file_path,
                line_start=e.line_start,
                line_end=e.line_end,
                snippet=e.snippet,
                blob_sha=e.blob_sha,
                strength=SignalStrength(e.strength),
                counted=e.counted,
            )
            for e in curr.evidence
        ]

        items.append(
            DiffItem(
                requirement_id=req_id,
                name=curr.requirement.name if curr.requirement else f"Requirement #{req_id}",
                before_status=before_status,
                after_status=after_status,
                change=change,
                evidence_added=curr_evidence if change != DiffChange.UNCHANGED else [],
                evidence_removed=[],
                reassessed=curr.reassessed,
                why=curr.summary,
                remaining_limitation=curr.limitation,
            )
        )

    # Get changed files from ChangeSet if present
    from backend.app.models import ChangeSet
    cs = db.query(ChangeSet).filter_by(analysis_id=latest.id).first()
    files_changed = cs.files_modified if cs and cs.files_modified else []

    return DiffResponse(
        analysis_id=latest.id,
        from_sha=previous.commit_sha,
        to_sha=latest.commit_sha,
        commit_message=latest.commit_message,
        files_changed=files_changed,
        items=items,
        reassessed_count=reassessed_count,
        carried_forward_count=carried_count,
    )


@router.post("/{track_id}/check")
async def check_track_now(track_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Manually triggers the polling watcher to check for new commits on this track."""
    track = db.query(Track).filter_by(id=track_id).first()
    if not track:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "TRACK_NOT_FOUND", "message": f"Track #{track_id} not found.", "retryable": False}},
        )

    from backend.app.watcher.poller import polling_watcher
    from backend.app.github.client import RateLimitError, GitHubError

    try:
        new_detected = await polling_watcher.check_track_now(track_id)
        db.refresh(track)
        return {
            "track_id": track_id,
            "new_commit_detected": new_detected,
            "current_sha": track.last_seen_sha,
            "watcher_mode": track.watcher_mode or "polling",
            "message": "New commit detected and reassessed." if new_detected else "Repository is up to date. No new commits found.",
        }
    except RateLimitError as e:
        raise HTTPException(
            status_code=429,
            detail={
                "error": {
                    "code": e.code,
                    "message": e.message,
                    "reset_epoch": e.reset_epoch,
                    "retryable": True,
                }
            },
        )
    except GitHubError as e:
        raise HTTPException(
            status_code=502,
            detail={
                "error": {
                    "code": e.code,
                    "message": e.message,
                    "retryable": True,
                }
            },
        )
