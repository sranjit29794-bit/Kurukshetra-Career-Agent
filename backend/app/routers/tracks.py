"""Tracks API router: create and retrieve persistent Job-Repo tracks."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.db import get_db

from backend.app.models import (
    AgentEvent as AgentEventModel,
    Analysis,
    Assessment as AssessmentModel,
    Evidence as EvidenceModel,
    FileCache,
    Job,
    Repo,
    Requirement,
    Track,
)
from backend.app.schemas import (
    AgentEvent,
    AgentEventDetail,
    AnalysisDetail,
    AnalysisKind,
    AnalysisStatus,
    Assessment,
    AssessmentStatus,
    AssessmentStrength,
    CoachingItem,
    CoachingProof,
    CoachingResponse,
    DiffChange,
    DiffItem,
    DiffResponse,
    EventLevel,
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
from backend.app.events import event_bus
from backend.app.github.client import GitHubClient, GitHubError, RateLimitError
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


def _serialize_analysis(
    analysis: Analysis,
    assessments: List[AssessmentModel],
    repo_html_url: Optional[str] = None,
) -> AnalysisDetail:
    assessment_schemas: List[Assessment] = []
    clean_repo_url = repo_html_url.rstrip("/") if repo_html_url else None
    for a in assessments:
        evidence_schemas = []
        for e in a.evidence:
            github_url = None
            if clean_repo_url and analysis.commit_sha and e.file_path:
                github_url = f"{clean_repo_url}/blob/{analysis.commit_sha}/{e.file_path}#L{e.line_start}-L{e.line_end}"

            evidence_schemas.append(
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
                    github_url=github_url,
                )
            )
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
async def analyze_track(track_id: int, force: bool = False, db: Session = Depends(get_db)) -> AnalysisDetail:
    """Executes Phase 3 real assessment on the target repository at pinned commit SHA:

    1. Resolves track, confirmed job requirements, and linked repository
    2. Enforces idempotency on (track_id, commit_sha), with explicit re-evaluation support when force=True
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
    if existing_analysis:
        if force:
            db.delete(existing_analysis)
            db.commit()
            existing_analysis = None
        elif existing_analysis.status == "complete":
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
        files_by_sha = {}
        seen_shas_in_batch = set()
        for f in analyzable_files:
            file_path = f["path"]
            blob_sha = f.get("sha", "")
            # Check local file cache
            cached = db.query(FileCache).filter_by(blob_sha=blob_sha).first()
            if cached:
                files_map[file_path] = cached.content
                files_by_sha[blob_sha] = cached.content
            elif blob_sha in files_by_sha:
                files_map[file_path] = files_by_sha[blob_sha]
            else:
                try:
                    content = await client.get_blob_content(repo.owner, repo.name, blob_sha)
                    files_map[file_path] = content
                    files_by_sha[blob_sha] = content
                    if blob_sha and blob_sha not in seen_shas_in_batch:
                        db.merge(FileCache(blob_sha=blob_sha, path=file_path, content=content))
                        seen_shas_in_batch.add(blob_sha)
                except Exception:
                    # Individual file fetch failure: record limitation without breaking whole run
                    continue
        db.commit()

        db.add(
            AgentEventModel(
                track_id=track.id,
                analysis_id=analysis.id,
                agent="RepoScout",
                level="info",
                message=f"Tree inspected at {commit_sha[:8]}. Analyzed {len(files_map)} files (scope: {scope.analyzed} accepted, {scope.skipped} skipped).",
                ts=datetime.utcnow(),
            )
        )

        # 3. Run deterministic detectors
        detected_signals = []
        for file_path, content in files_map.items():
            f_entry = next((e for e in analyzable_files if e["path"] == file_path), {})
            blob_sha = f_entry.get("sha", "")
            signals = run_all_detectors(file_path, content, blob_sha)
            detected_signals.extend(signals)

        # 4. Skeptic Verifier independent verification
        verified_evidence, dropped = SkepticVerifier.verify_all(detected_signals, files_map)

        db.add(
            AgentEventModel(
                track_id=track.id,
                analysis_id=analysis.id,
                agent="SkepticVerifier",
                level="info",
                message=f"Verified {len(verified_evidence)} AST signals across codebase ({len(dropped)} unverified/mismatched dropped).",
                ts=datetime.utcnow(),
            )
        )

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

        dem_count = sum(1 for a in persisted_assessments if a.status == "DEMONSTRATED")
        part_count = sum(1 for a in persisted_assessments if a.status == "PARTIAL")
        gap_count = sum(1 for a in persisted_assessments if a.status == "NOT_DEMONSTRATED")
        db.add(
            AgentEventModel(
                track_id=track.id,
                analysis_id=analysis.id,
                agent="EvidenceEngine",
                level="success",
                message=f"Deterministic evaluation complete for {len(persisted_assessments)} requirements: {dem_count} demonstrated, {part_count} partial, {gap_count} scope gaps.",
                ts=datetime.utcnow(),
            )
        )

        analysis.status = "complete"
        analysis.scope = scope.model_dump()
        analysis.finished_at = datetime.utcnow()
        db.commit()
        db.refresh(analysis)

        repo_html_url = track.repo.html_url if track.repo else None
        return _serialize_analysis(analysis, persisted_assessments, repo_html_url)

    except RateLimitError as e:
        analysis.status = "failed"
        analysis.error = e.message
        analysis.finished_at = datetime.utcnow()
        db.commit()
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
        analysis.status = "failed"
        analysis.error = e.message
        analysis.finished_at = datetime.utcnow()
        db.commit()
        raise HTTPException(
            status_code=e.status_code if e.status_code < 500 else 502,
            detail={"error": {"code": e.code, "message": e.message, "retryable": e.retryable}},
        )
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

    repo_html_url = track.repo.html_url if track.repo else None
    results = []
    for a in analyses:
        assessments = db.query(AssessmentModel).filter_by(analysis_id=a.id).all()
        results.append(_serialize_analysis(a, assessments, repo_html_url))

    return results


@router.get("/{track_id}/analyses/{analysis_id}", response_model=AnalysisDetail)
async def get_track_analysis(
    track_id: int,
    analysis_id: int,
    db: Session = Depends(get_db),
) -> AnalysisDetail:
    """Retrieves a specific historical assessment analysis for a track."""
    track = db.query(Track).filter_by(id=track_id).first()
    if not track:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "TRACK_NOT_FOUND", "message": f"Track #{track_id} not found.", "retryable": False}},
        )

    analysis = db.query(Analysis).filter_by(id=analysis_id, track_id=track.id).first()
    if not analysis:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "ANALYSIS_NOT_FOUND", "message": f"Analysis #{analysis_id} not found for track #{track_id}.", "retryable": False}},
        )

    assessments = db.query(AssessmentModel).filter_by(analysis_id=analysis.id).all()
    repo_html_url = track.repo.html_url if track.repo else None
    return _serialize_analysis(analysis, assessments, repo_html_url)


@router.get("/{track_id}/diff", response_model=Optional[DiffResponse])
async def get_track_diff(
    track_id: int,
    from_analysis_id: Optional[int] = None,
    to_analysis_id: Optional[int] = None,
    db: Session = Depends(get_db),
) -> Optional[DiffResponse]:
    """Computes before/after comparison between two analyses (defaulting to latest two)."""
    track = db.query(Track).filter_by(id=track_id).first()
    if not track:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "TRACK_NOT_FOUND", "message": f"Track #{track_id} not found.", "retryable": False}},
        )

    if from_analysis_id is not None and to_analysis_id is not None:
        latest = db.query(Analysis).filter_by(id=to_analysis_id, track_id=track.id).first()
        previous = db.query(Analysis).filter_by(id=from_analysis_id, track_id=track.id).first()
        if not latest or not previous:
            raise HTTPException(
                status_code=404,
                detail={"error": {"code": "ANALYSIS_NOT_FOUND", "message": "Specified analysis IDs not found for comparison.", "retryable": False}},
            )
    else:
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
    clean_repo_url = track.repo.html_url.rstrip("/") if track.repo and track.repo.html_url else None

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
                github_url=f"{clean_repo_url}/blob/{latest.commit_sha}/{e.file_path}#L{e.line_start}-L{e.line_end}" if clean_repo_url and latest.commit_sha and e.file_path else None,
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
        from_analysis_id=previous.id,
        to_analysis_id=latest.id,
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


@router.get("/{track_id}/events", response_model=List[AgentEventDetail])
def get_track_events(track_id: int, db: Session = Depends(get_db)) -> List[AgentEventDetail]:
    """Retrieves chronological execution events for a specific track."""
    track = db.query(Track).filter_by(id=track_id).first()
    if not track:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "TRACK_NOT_FOUND", "message": f"Track #{track_id} not found.", "retryable": False}},
        )

    db_events = (
        db.query(AgentEventModel)
        .filter_by(track_id=track_id)
        .order_by(AgentEventModel.ts.desc())
        .limit(100)
        .all()
    )

    analysis_ids = {e.analysis_id for e in db_events if e.analysis_id}
    analyses_map = {a.id: a for a in db.query(Analysis).filter(Analysis.id.in_(analysis_ids)).all()} if analysis_ids else {}

    track_title = track.job.title if track.job else None
    repo_name = f"{track.repo.owner}/{track.repo.name}" if track.repo else None

    results: List[AgentEventDetail] = []
    for ev in db_events:
        commit_sha = None
        if ev.analysis_id and ev.analysis_id in analyses_map:
            commit_sha = analyses_map[ev.analysis_id].commit_sha
        elif track.last_seen_sha:
            commit_sha = track.last_seen_sha

        try:
            level_enum = EventLevel(ev.level)
        except Exception:
            level_enum = EventLevel.INFO

        results.append(
            AgentEventDetail(
                id=ev.id,
                track_id=ev.track_id,
                analysis_id=ev.analysis_id,
                agent=ev.agent,
                level=level_enum,
                message=ev.message,
                timestamp=ev.ts,
                commit_sha=commit_sha,
                track_title=track_title,
                repo_name=repo_name,
            )
        )
    return results


@router.get("/{track_id}/coaching", response_model=CoachingResponse)
@router.get("/{track_id}/plan", response_model=CoachingResponse)
def get_track_coaching(track_id: int, db: Session = Depends(get_db)) -> CoachingResponse:
    """Returns grounded, evidence-backed career coaching recommendations.

    Every recommendation is derived strictly from confirmed job requirements and
    the latest complete assessment. Strengths cite verified code lines; gaps provide
    concrete implementation steps and explain that missing repo evidence is never
    proof of missing student capability.
    """
    track = db.query(Track).filter_by(id=track_id).first()
    if not track:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "TRACK_NOT_FOUND", "message": f"Track #{track_id} not found.", "retryable": False}},
        )

    analysis = (
        db.query(Analysis)
        .filter_by(track_id=track.id, status="complete")
        .order_by(Analysis.started_at.desc())
        .first()
    )
    if not analysis:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NO_ANALYSIS_FOUND", "message": "No completed analysis found for this track. Run an assessment first.", "retryable": False}},
        )

    assessments = db.query(AssessmentModel).filter_by(analysis_id=analysis.id).all()
    clean_repo_url = track.repo.html_url.rstrip("/") if track.repo and track.repo.html_url else None
    repo_full_name = f"{track.repo.owner}/{track.repo.name}" if track.repo else "repository"
    track_title = track.job.title if track.job else f"Track #{track.id}"

    coaching_items: List[CoachingItem] = []
    strengths_count = 0
    gaps_count = 0

    for asm in assessments:
        req = asm.requirement
        req_name = req.name if req else f"Requirement #{asm.requirement_id}"
        req_category = req.category if req else "technical"
        req_priority = req.priority if req else "must"
        status_enum = AssessmentStatus(asm.status)

        # Extract verified proof citations
        proof_list: List[CoachingProof] = []
        for e in asm.evidence:
            github_url = (
                f"{clean_repo_url}/blob/{analysis.commit_sha}/{e.file_path}#L{e.line_start}-L{e.line_end}"
                if clean_repo_url and analysis.commit_sha and e.file_path
                else None
            )
            proof_list.append(
                CoachingProof(
                    file_path=e.file_path,
                    line_start=e.line_start,
                    line_end=e.line_end,
                    detector=e.detector,
                    snippet=e.snippet,
                    github_url=github_url,
                )
            )

        if status_enum == AssessmentStatus.DEMONSTRATED:
            strengths_count += 1
            action_title = f"Maintain and Harden Verified {req_name}"
            why = f"Your repository already demonstrates verified proof of {req_name} with {len(proof_list)} verified citation(s). Code matches AST structural criteria."
            first_path = proof_list[0].file_path if proof_list else "your codebase"
            implementation_guide = f"Add automated regression test coverage for existing handlers in {first_path} and document architectural contracts."
            estimated_effort = "30 mins"
            scope_caveat = None
            is_actionable = False
            status_claim = "verified_strength"

        elif status_enum == AssessmentStatus.PARTIAL:
            gaps_count += 1
            action_title = f"Elevate {req_name} from Partial Signals to Full Verification"
            why = asm.limitation or f"Partial code patterns for {req_name} were observed, but additional structural coverage or explicit parameter bindings are required."
            first_path = proof_list[0].file_path if proof_list else "your codebase"
            implementation_guide = asm.next_step or f"Expand implementation in {first_path} to provide complete parameter bindings or comprehensive assertions."
            estimated_effort = "45-60 mins"
            scope_caveat = "Partial signal verified; additional scope needed for full demonstration."
            is_actionable = True
            status_claim = "recommendation"

        else:  # NOT_DEMONSTRATED or UNABLE_TO_ASSESS
            gaps_count += 1
            action_title = f"Implement Concrete Code Artifacts for {req_name}"
            why = f"No verified code evidence was detected within the analyzed repository scope at commit {analysis.commit_sha[:8]}."

            tax = (req.taxonomy_key or req_category or "").lower()
            if "sql" in tax or "database" in tax:
                implementation_guide = "Add a database module using SQLite or SQLAlchemy with parameterized queries (e.g. `cursor.execute('SELECT * FROM items WHERE id = ?', (item_id,))`). Include a schema definition or migration file."
            elif "test" in tax:
                implementation_guide = "Create a `tests/` directory with `test_*.py` files. Add pytest test functions with meaningful assertions (e.g. testing status codes, JSON payload responses, or edge cases). Avoid trivial `assert True`."
            elif "api" in tax or "rest" in tax:
                implementation_guide = "Define FastAPI or Flask route handlers (e.g. `@app.get('/items')`, `@app.post('/items')`) with request validation schemas and structured JSON return types."
            elif "deploy" in tax:
                implementation_guide = "Add a multi-stage `Dockerfile` specifying a base image (`python:3.11-slim`), dependencies installation, and `CMD` entrypoint for your application."
            elif "ci" in tax:
                implementation_guide = "Add a `.github/workflows/ci.yml` file running pytest and linting on push or pull requests."
            else:
                implementation_guide = f"Implement a dedicated module demonstrating practical usage of {req_name} in your project codebase."

            scope_caveat = f"Scope caveat: evidence was not detected in inspected files for commit {analysis.commit_sha[:8]}. This does not indicate a lack of candidate skill or qualification."
            estimated_effort = "1-2 hours"
            is_actionable = True
            status_claim = "recommendation"

        coaching_items.append(
            CoachingItem(
                requirement_id=asm.requirement_id,
                requirement_name=req_name,
                category=req_category,
                priority=req_priority,
                status=status_enum,
                status_label=status_enum.value,
                action_title=action_title,
                why=why,
                implementation_guide=implementation_guide,
                estimated_effort=estimated_effort,
                verified_proof=proof_list,
                scope_caveat=scope_caveat,
                is_actionable=is_actionable,
                status_claim=status_claim,
            )
        )

    # Sort items: actionable must-have gaps first, then nice-to-have gaps, then verified strengths
    coaching_items.sort(
        key=lambda it: (
            0 if it.is_actionable and it.priority == "must" else
            1 if it.is_actionable else
            2
        )
    )

    summary = (
        f"Portfolio demonstrates {strengths_count} requirement(s) verified by Skeptic AST checks. "
        f"Identified {gaps_count} actionable improvement opportunity(ies) grounded in repository analysis at commit {analysis.commit_sha[:8]}."
    )

    return CoachingResponse(
        track_id=track.id,
        track_title=track_title,
        repo_full_name=repo_full_name,
        commit_sha=analysis.commit_sha,
        generated_at=datetime.utcnow(),
        ai_used=analysis.ai_used,
        summary=summary,
        strengths_count=strengths_count,
        gaps_count=gaps_count,
        items=coaching_items,
    )
