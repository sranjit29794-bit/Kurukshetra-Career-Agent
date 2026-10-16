"""Reassessment engine: Handles new commit discovery, changed-file diffing,

targeted assessment of affected requirements, and immutable history recording.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.detectors.runner import run_all_detectors
from backend.app.evaluator.engine import AssessmentEngine
from backend.app.evaluator.impact import map_changed_paths_to_taxonomies
from backend.app.events import event_bus
from backend.app.github.client import GitHubClient
from backend.app.github.files import filter_tree_files
from backend.app.models import (
    AgentEvent as AgentEventModel,
    Analysis,
    Assessment as AssessmentModel,
    ChangeSet as ChangeSetModel,
    Evidence as EvidenceModel,
    FileCache,
    Job,
    Repo,
    Requirement,
    Track,
)
from backend.app.schemas import (
    AgentEvent,
    AnalysisDetail,
    AnalysisKind,
    AnalysisStatus,
    Assessment,
    AssessmentStatus,
    AssessmentStrength,
    DiffChange,
    DiffItem,
    DiffResponse,
    EventLevel,
    EvidenceItem,
    RequirementDraft,
    SignalStrength,
    Trigger,
)
from backend.app.verifier.skeptic import SkepticVerifier


async def process_new_commit(
    track_id: int,
    new_sha: str,
    trigger: Trigger,
    commit_message: Optional[str] = None,
    db: Session = None,
) -> Optional[AnalysisDetail]:
    """Core idempotency and reassessment pipeline for both Webhooks and Poller:

    1. Checks if an analysis already exists for (track_id, new_sha) -> idempotency
    2. Retrieves previous completed analysis to compute diff
    3. Compares commits via GitHub API or tree comparison to identify changed paths
    4. Maps changed paths to affected requirements
    5. Carries forward unaffected requirements, re-evaluates affected requirements
    6. Persists new Analysis, Assessments, Evidence, ChangeSet, and emits live AgentEvents
    """
    track = db.query(Track).filter_by(id=track_id).first()
    if not track:
        return None

    repo = db.query(Repo).filter_by(id=track.repo_id).first()
    job = db.query(Job).filter_by(id=track.job_id).first()
    reqs = db.query(Requirement).filter_by(job_id=job.id).order_by(Requirement.position.asc()).all()

    # 1. Idempotency constraint check
    existing_analysis = db.query(Analysis).filter_by(track_id=track.id, commit_sha=new_sha).first()
    if existing_analysis and existing_analysis.status == "complete":
        # Already analyzed; return serialized result
        from backend.app.routers.tracks import _serialize_analysis
        assessments = db.query(AssessmentModel).filter_by(analysis_id=existing_analysis.id).all()
        return _serialize_analysis(existing_analysis, assessments)

    # 2. Find previous analysis to diff against
    prev_analysis = (
        db.query(Analysis)
        .filter_by(track_id=track.id, status="complete")
        .order_by(Analysis.started_at.desc())
        .first()
    )

    # Emit event: Push/Commit Detected
    now = datetime.utcnow()
    event_msg = f"Change Sentinel: Detected new commit {new_sha[:8]} on branch '{track.branch}' via {trigger.value}"
    db.add(AgentEventModel(track_id=track.id, agent="ChangeSentinel", level="info", message=event_msg, ts=now))
    db.commit()
    await event_bus.emit(AgentEvent(track_id=track.id, agent="ChangeSentinel", level=EventLevel.INFO, message=event_msg, timestamp=now))

    # Initialize new Analysis in running state
    analysis = Analysis(
        track_id=track.id,
        commit_sha=new_sha,
        commit_message=commit_message,
        trigger=trigger.value,
        kind=AnalysisKind.REASSESSMENT.value if prev_analysis else AnalysisKind.INITIAL.value,
        status=AnalysisStatus.RUNNING.value,
        prev_analysis_id=prev_analysis.id if prev_analysis else None,
        started_at=now,
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    client = GitHubClient()

    try:
        # 3. Determine changed files
        changed_files: List[str] = []
        if prev_analysis and prev_analysis.commit_sha != new_sha:
            try:
                compare_data = await client.compare_commits(repo.owner, repo.name, prev_analysis.commit_sha, new_sha)
                changed_files = compare_data.get("files_changed", [])
            except Exception:
                # If comparison fails (e.g. force push or history disconnect), fall back to full tree inspection
                changed_files = []

        # 4. Fetch tree at new_sha
        tree_entries, truncated = await client.get_tree(repo.owner, repo.name, new_sha)
        analyzable_files, scope = filter_tree_files(tree_entries, truncated=truncated)

        # Emit event: Repo Scout scope
        scope_msg = f"Repo Scout: Filtered scope at {new_sha[:8]} ({scope.analyzed} files analyzed, {scope.skipped} skipped)"
        db.add(AgentEventModel(track_id=track.id, analysis_id=analysis.id, agent="RepoScout", level="info", message=scope_msg, ts=datetime.utcnow()))
        db.commit()
        await event_bus.emit(AgentEvent(track_id=track.id, analysis_id=analysis.id, agent="RepoScout", level=EventLevel.INFO, message=scope_msg, timestamp=datetime.utcnow()))

        # Fetch files content (cached by blob SHA)
        files_map: Dict[str, str] = {}
        for f in analyzable_files:
            file_path = f["path"]
            blob_sha = f.get("sha", "")
            cached = db.query(FileCache).filter_by(blob_sha=blob_sha).first()
            if cached:
                files_map[file_path] = cached.content
            else:
                try:
                    content = await client.get_blob_content(repo.owner, repo.name, blob_sha)
                    db.merge(FileCache(blob_sha=blob_sha, path=file_path, content=content))
                    files_map[file_path] = content
                except Exception:
                    continue
        db.commit()

        # 5. Targeted reassessment logic
        affected_taxonomies = map_changed_paths_to_taxonomies(changed_files) if changed_files else set()
        is_targeted = bool(prev_analysis and changed_files and affected_taxonomies)

        # Run detectors over files
        detected_signals = []
        for file_path, content in files_map.items():
            f_entry = next((e for e in analyzable_files if e["path"] == file_path), {})
            blob_sha = f_entry.get("sha", "")
            signals = run_all_detectors(file_path, content, blob_sha)
            detected_signals.extend(signals)

        # Run Skeptic Verifier
        verified_evidence, dropped = SkepticVerifier.verify_all(detected_signals, files_map)

        # Requirement drafts
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

        # Retrieve previous assessments to carry forward or diff
        prev_assessments_map = {}
        if prev_analysis:
            prev_asms = db.query(AssessmentModel).filter_by(analysis_id=prev_analysis.id).all()
            for pa in prev_asms:
                prev_assessments_map[pa.requirement_id] = pa

        persisted_assessments: List[AssessmentModel] = []
        for ca in computed_assessments:
            req_id = ca.requirement_id
            taxonomy = ca.taxonomy_key if hasattr(ca, "taxonomy_key") else None
            prev_asm = prev_assessments_map.get(req_id)

            # If targeted and this requirement was NOT touched by changed files, carry forward!
            should_carry_forward = is_targeted and taxonomy and (taxonomy not in affected_taxonomies) and prev_asm is not None

            if should_carry_forward and prev_asm:
                # Carry forward previous assessment
                new_asm = AssessmentModel(
                    analysis_id=analysis.id,
                    requirement_id=req_id,
                    status=prev_asm.status,
                    strength=prev_asm.strength,
                    summary=f"[Carried Forward] {prev_asm.summary}",
                    limitation=prev_asm.limitation,
                    next_step=prev_asm.next_step,
                    carried_forward=True,
                    reassessed=False,
                    ai_used=False,
                )
                db.add(new_asm)
                db.flush()
                # Copy verified evidence
                for pe in prev_asm.evidence:
                    db.add(
                        EvidenceModel(
                            assessment_id=new_asm.id,
                            signal_id=pe.signal_id,
                            detector=pe.detector,
                            file_path=pe.file_path,
                            line_start=pe.line_start,
                            line_end=pe.line_end,
                            snippet=pe.snippet,
                            blob_sha=pe.blob_sha,
                            strength=pe.strength,
                            counted=pe.counted,
                        )
                    )
                persisted_assessments.append(new_asm)
            else:
                # Freshly evaluated requirement
                new_asm = AssessmentModel(
                    analysis_id=analysis.id,
                    requirement_id=req_id,
                    status=ca.status.value,
                    strength=ca.strength.value,
                    summary=ca.summary,
                    limitation=ca.limitation,
                    next_step=ca.next_step,
                    carried_forward=False,
                    reassessed=True,
                    ai_used=False,
                )
                db.add(new_asm)
                db.flush()
                for ev in ca.evidence:
                    db.add(
                        EvidenceModel(
                            assessment_id=new_asm.id,
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
                    )
                persisted_assessments.append(new_asm)

        # 6. Save ChangeSet record
        if prev_analysis:
            cs = ChangeSetModel(
                analysis_id=analysis.id,
                before_sha=prev_analysis.commit_sha,
                after_sha=new_sha,
                files_modified=changed_files,
                impact_plan={"affected_taxonomies": list(affected_taxonomies), "targeted": is_targeted},
            )
            db.add(cs)

        # Complete Analysis
        analysis.status = AnalysisStatus.COMPLETE.value
        analysis.scope = scope.model_dump()
        analysis.finished_at = datetime.utcnow()
        track.last_seen_sha = new_sha
        db.commit()
        db.refresh(analysis)

        # Emit completion event
        complete_msg = f"Evidence Engine: Completed assessment at {new_sha[:8]} ({len(persisted_assessments)} requirements evaluated)"
        db.add(AgentEventModel(track_id=track.id, analysis_id=analysis.id, agent="EvidenceEngine", level="success", message=complete_msg, ts=datetime.utcnow()))
        db.commit()
        await event_bus.emit(AgentEvent(track_id=track.id, analysis_id=analysis.id, agent="EvidenceEngine", level=EventLevel.SUCCESS, message=complete_msg, timestamp=datetime.utcnow()))

        from backend.app.routers.tracks import _serialize_analysis
        return _serialize_analysis(analysis, persisted_assessments)

    except Exception as e:
        analysis.status = AnalysisStatus.FAILED.value
        analysis.error = str(e)
        analysis.finished_at = datetime.utcnow()
        db.commit()
        err_msg = f"Evidence Engine: Reassessment failed at {new_sha[:8]}: {str(e)}"
        await event_bus.emit(AgentEvent(track_id=track.id, analysis_id=analysis.id, agent="EvidenceEngine", level=EventLevel.ERROR, message=err_msg, timestamp=datetime.utcnow()))
        return None
