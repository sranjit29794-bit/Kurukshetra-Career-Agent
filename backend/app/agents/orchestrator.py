"""Evidence analysis orchestrator coordinating Scout, Detectors, Rules, and Diff generation.

Reference: docs/BRAIN.md (§5, §6, §10, §14) and docs/PLAN-5H.md (Phase BE-2).

Hard Invariants:
1. No evidence -> no credit.
2. Idempotent on (track_id, commit_sha).
3. Partial failure keeps previous assessment labeled carried_forward=True.
4. Testing is capped at PARTIAL until a successful CI check run is read (never execute student code).
5. Unchanged skills are labeled "Not reassessed: no related files changed".
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.agents.repo_scout import repo_scout
from backend.app.detectors.base import BaseDetector
from backend.app.detectors.generic_keyword import GenericKeywordDetector
from backend.app.detectors.registry import get_detector
from backend.app.events import event_bus
from backend.app.llm.fallback import (
    generate_deterministic_explanation,
    generate_deterministic_limitations,
    generate_deterministic_next_steps,
)
from backend.app.models import (
    AnalysisModel,
    AssessmentModel,
    ChangeSetModel,
    EvidenceModel,
    RequirementModel,
    TrackModel,
)
from backend.app.schemas import (
    AnalysisKind,
    AnalysisStatus,
    Signal,
    Status,
    Strength,
    Trigger,
)
from backend.app.services.diff_builder import build_analysis_diff
from backend.app.services.impact_map import compute_impact
from backend.app.services.status_rules import decide

logger = logging.getLogger(__name__)


class Orchestrator:
    """Coordinates analysis pipelines for initial assessments and push-triggered reassessments."""

    async def run_initial_assessment(
        self,
        track_id: str,
        sha: str,
        db: Session,
        trigger: Trigger = Trigger.manual,
    ) -> AnalysisModel:
        """Execute initial comprehensive assessment for a track at a specific commit SHA."""
        # 1. Idempotency check: if analysis already exists for (track_id, sha), return it
        stmt = select(AnalysisModel).where(
            AnalysisModel.track_id == track_id,
            AnalysisModel.commit_sha == sha,
        )
        existing = db.scalars(stmt).first()
        if existing:
            logger.info(
                "Analysis already exists for track %s at sha %s (idempotent)",
                track_id,
                sha,
            )
            return existing

        track = db.get(TrackModel, track_id)
        if not track:
            raise ValueError(f"Track not found: {track_id}")

        analysis_id = f"analysis_{uuid.uuid4().hex[:12]}"
        analysis = AnalysisModel(
            id=analysis_id,
            track_id=track_id,
            commit_sha=sha,
            commit_message="Initial repository assessment",
            trigger=trigger.value,
            kind=AnalysisKind.initial.value,
            status=AnalysisStatus.running.value,
            started_at=datetime.now(UTC),
        )
        db.add(analysis)
        db.commit()

        event_bus.emit(
            agent="Orchestrator",
            message=f"Starting initial analysis for track {track_id} at {sha[:7]}",
            level="info",
            track_id=track_id,
        )

        try:
            # Fetch repository tree & blobs
            repo = track.repo
            snapshot = await repo_scout.fetch_snapshot(
                repo.html_url, branch=track.branch, db_session=db, track_id=track_id
            )
            analysis.scope = snapshot.scope.model_dump()
            file_contents = {
                f.path: f.content for f in snapshot.files if f.content is not None
            }

            # Evaluate each requirement
            requirements = db.scalars(
                select(RequirementModel).where(RequirementModel.job_id == track.job_id)
            ).all()

            for req in requirements:
                signals = self._run_detectors_for_req(req, file_contents)
                status, strength, ignored_signals = decide(signals, req.taxonomy_key)

                explanation = generate_deterministic_explanation(
                    status, req.name, signals
                )
                next_steps = generate_deterministic_next_steps(status, req.taxonomy_key)
                deterministic_lims = generate_deterministic_limitations(
                    status, req.taxonomy_key, signals
                )

                asmt = AssessmentModel(
                    id=f"asmt_{uuid.uuid4().hex[:12]}",
                    analysis_id=analysis_id,
                    requirement_id=req.id,
                    status=status.value,
                    strength=strength.value,
                    summary=explanation,
                    limitation="; ".join(deterministic_lims)
                    if deterministic_lims
                    else "None noted.",
                    next_step="; ".join(next_steps) if next_steps else "None",
                    carried_forward=False,
                    reassessed=True,
                    ignored_signals=ignored_signals,
                    ai_used=False,
                )
                db.add(asmt)

                # Add counted evidence records
                for sig in signals:
                    if sig.counted:
                        ev = EvidenceModel(
                            id=f"ev_{uuid.uuid4().hex[:12]}",
                            assessment_id=asmt.id,
                            signal_id=sig.signal_id,
                            detector=sig.detector,
                            file_path=sig.file_path,
                            line_start=sig.line_start,
                            line_end=sig.line_end,
                            snippet=sig.snippet,
                            blob_sha=sig.blob_sha,
                            strength=sig.strength.value,
                            counted=True,
                        )
                        db.add(ev)

            # Mark analysis complete
            analysis.status = AnalysisStatus.complete.value
            analysis.finished_at = datetime.now(UTC)
            track.last_seen_sha = sha
            db.commit()

            event_bus.emit(
                agent="Orchestrator",
                message=f"Initial assessment complete for {sha[:7]}",
                level="info",
                track_id=track_id,
            )
            return analysis

        except Exception as err:
            logger.exception(
                "Initial assessment failed for track %s: %s", track_id, err
            )
            analysis.status = AnalysisStatus.failed.value
            analysis.error = str(err)
            db.commit()
            raise

    async def run_reassessment(
        self,
        track_id: str,
        new_sha: str,
        changed_files: list[str],
        commit_message: str,
        db: Session,
        trigger: Trigger = Trigger.webhook,
    ) -> AnalysisModel:
        """Execute impact-aware reassessment on new commit push."""
        # 1. Idempotency check
        stmt = select(AnalysisModel).where(
            AnalysisModel.track_id == track_id,
            AnalysisModel.commit_sha == new_sha,
        )
        existing = db.scalars(stmt).first()
        if existing:
            return existing

        track = db.get(TrackModel, track_id)
        if not track:
            raise ValueError(f"Track not found: {track_id}")

        # Find previous complete analysis
        prev_analysis = db.scalars(
            select(AnalysisModel)
            .where(
                AnalysisModel.track_id == track_id,
                AnalysisModel.status == AnalysisStatus.complete.value,
            )
            .order_by(AnalysisModel.started_at.desc())
        ).first()

        prev_sha = (
            prev_analysis.commit_sha
            if prev_analysis
            else (track.last_seen_sha or new_sha)
        )

        # 2. Impact analysis
        impact = compute_impact(changed_files)
        analysis_id = f"analysis_{uuid.uuid4().hex[:12]}"
        analysis = AnalysisModel(
            id=analysis_id,
            track_id=track_id,
            commit_sha=new_sha,
            commit_message=commit_message,
            trigger=trigger.value,
            kind=AnalysisKind.reassessment.value,
            status=AnalysisStatus.running.value,
            prev_analysis_id=prev_analysis.id if prev_analysis else None,
            started_at=datetime.now(UTC),
        )
        db.add(analysis)
        db.commit()

        # If docs only: no skill reassessment needed
        if impact.is_docs_only:
            event_bus.emit(
                agent="ChangeSentinel",
                message=f"Push detected at {new_sha[:7]}: docs only, no skill change",
                level="info",
                track_id=track_id,
            )

            # Carry forward all previous assessments
            if prev_analysis:
                for old_asmt in prev_analysis.assessments:
                    carried = AssessmentModel(
                        id=f"asmt_{uuid.uuid4().hex[:12]}",
                        analysis_id=analysis_id,
                        requirement_id=old_asmt.requirement_id,
                        status=old_asmt.status,
                        strength=old_asmt.strength,
                        summary=old_asmt.summary,
                        limitation=old_asmt.limitation,
                        next_step=old_asmt.next_step,
                        carried_forward=True,
                        reassessed=False,
                        ignored_signals=old_asmt.ignored_signals,
                        ai_used=old_asmt.ai_used,
                    )
                    db.add(carried)

            analysis.status = AnalysisStatus.complete.value
            analysis.finished_at = datetime.now(UTC)
            track.last_seen_sha = new_sha
            db.commit()
            return analysis

        # Code files changed: perform impact-aware reassessment
        repo = track.repo
        snapshot = await repo_scout.fetch_snapshot(
            repo.html_url, branch=track.branch, db_session=db, track_id=track_id
        )
        analysis.scope = snapshot.scope.model_dump()
        file_contents = {
            f.path: f.content for f in snapshot.files if f.content is not None
        }

        requirements = db.scalars(
            select(RequirementModel).where(RequirementModel.job_id == track.job_id)
        ).all()

        prev_asmt_map: dict[str, dict[str, Any]] = {}
        if prev_analysis:
            for a in prev_analysis.assessments:
                prev_asmt_map[a.requirement_id] = {
                    "status": a.status,
                    "strength": a.strength,
                    "name": a.requirement.name if a.requirement else a.requirement_id,
                    "evidence": [
                        {
                            "signal_id": e.signal_id,
                            "file_path": e.file_path,
                            "snippet": e.snippet,
                            "strength": e.strength,
                        }
                        for e in a.evidence
                    ],
                }

        curr_asmt_map: dict[str, dict[str, Any]] = {}
        reassessed_req_ids: set[str] = set()

        for req in requirements:
            # Check if this requirement is affected by changed files
            should_reassess = (
                req.taxonomy_key in impact.affected_keys
                or "generic_keyword" in impact.affected_keys
                or not prev_analysis
            )

            if should_reassess:
                reassessed_req_ids.add(req.id)
                signals = self._run_detectors_for_req(req, file_contents)
                status, strength, ignored_signals = decide(signals, req.taxonomy_key)

                explanation = generate_deterministic_explanation(
                    status, req.name, signals
                )
                next_steps = generate_deterministic_next_steps(status, req.taxonomy_key)
                deterministic_lims = generate_deterministic_limitations(
                    status, req.taxonomy_key, signals
                )

                asmt = AssessmentModel(
                    id=f"asmt_{uuid.uuid4().hex[:12]}",
                    analysis_id=analysis_id,
                    requirement_id=req.id,
                    status=status.value,
                    strength=strength.value,
                    summary=explanation,
                    limitation="; ".join(deterministic_lims)
                    if deterministic_lims
                    else "None noted.",
                    next_step="; ".join(next_steps) if next_steps else "None",
                    carried_forward=False,
                    reassessed=True,
                    ignored_signals=ignored_signals,
                    ai_used=False,
                )
                db.add(asmt)

                ev_list = []
                for sig in signals:
                    if sig.counted:
                        ev = EvidenceModel(
                            id=f"ev_{uuid.uuid4().hex[:12]}",
                            assessment_id=asmt.id,
                            signal_id=sig.signal_id,
                            detector=sig.detector,
                            file_path=sig.file_path,
                            line_start=sig.line_start,
                            line_end=sig.line_end,
                            snippet=sig.snippet,
                            blob_sha=sig.blob_sha,
                            strength=sig.strength.value,
                            counted=True,
                        )
                        db.add(ev)
                        ev_list.append(
                            {
                                "signal_id": sig.signal_id,
                                "file_path": sig.file_path,
                                "snippet": sig.snippet,
                                "strength": sig.strength.value,
                            }
                        )

                curr_asmt_map[req.id] = {
                    "status": status.value,
                    "strength": strength.value,
                    "name": req.name,
                    "evidence": ev_list,
                }
            else:
                # Carry forward unchanged assessment
                old_info = prev_asmt_map.get(req.id, {})
                asmt = AssessmentModel(
                    id=f"asmt_{uuid.uuid4().hex[:12]}",
                    analysis_id=analysis_id,
                    requirement_id=req.id,
                    status=old_info.get("status", Status.NOT_DEMONSTRATED.value),
                    strength=old_info.get("strength", Strength.none.value),
                    summary=f"Carried forward from previous commit {prev_sha[:7]}.",
                    limitation="Not reassessed: no related files changed.",
                    next_step="None",
                    carried_forward=True,
                    reassessed=False,
                    ignored_signals=[],
                    ai_used=False,
                )
                db.add(asmt)
                curr_asmt_map[req.id] = {
                    "status": asmt.status,
                    "strength": asmt.strength,
                    "name": req.name,
                    "evidence": old_info.get("evidence", []),
                }

        # Build analysis diff
        diff_data = build_analysis_diff(
            from_sha=prev_sha,
            to_sha=new_sha,
            commit_message=commit_message,
            files_changed=changed_files,
            previous_assessments=prev_asmt_map,
            current_assessments=curr_asmt_map,
            reassessed_req_ids=reassessed_req_ids,
        )

        change_set = ChangeSetModel(
            id=f"cs_{uuid.uuid4().hex[:12]}",
            analysis_id=analysis_id,
            before_sha=prev_sha,
            after_sha=new_sha,
            files_modified=changed_files,
            impact_plan=diff_data,
        )
        db.add(change_set)

        analysis.status = AnalysisStatus.complete.value
        analysis.finished_at = datetime.now(UTC)
        track.last_seen_sha = new_sha
        db.commit()

        # Emit reassessment update event with diff
        event_bus.emit(
            agent="Orchestrator",
            message=f"Reassessment complete: {len(reassessed_req_ids)} skill(s) updated for {new_sha[:7]}",
            level="info",
            track_id=track_id,
        )
        return analysis

    async def upgrade_ci_testing(
        self,
        track_id: str,
        head_sha: str,
        db: Session,
    ) -> bool:
        """Upgrade Testing status to CI-verified (E4) after a successful GitHub check run."""
        stmt = select(AnalysisModel).where(
            AnalysisModel.track_id == track_id,
            AnalysisModel.commit_sha == head_sha,
            AnalysisModel.status == AnalysisStatus.complete.value,
        )
        analysis = db.scalars(stmt).first()
        if not analysis:
            return False

        upgraded = False
        for asmt in analysis.assessments:
            req = asmt.requirement
            if (
                req
                and req.taxonomy_key == "testing"
                and asmt.status == Status.PARTIAL.value
            ):
                asmt.status = Status.DEMONSTRATED.value
                asmt.strength = Strength.strong.value
                asmt.summary = "Verified implementation evidence: unit test suite passed in GitHub Actions CI workflow."
                asmt.limitation = "CI workflow run succeeded on GitHub."
                upgraded = True

        if upgraded:
            db.commit()
            event_bus.emit(
                agent="Orchestrator",
                message=f"CI workflow succeeded for {head_sha[:7]}: Testing upgraded to CI-verified",
                level="info",
                track_id=track_id,
            )
        return upgraded

    def _run_detectors_for_req(
        self,
        req: RequirementModel,
        files: dict[str, str],
    ) -> list[Signal]:
        """Run appropriate detectors for a requirement across repository files."""
        detector: BaseDetector | None = None
        if req.taxonomy_key:
            detector = get_detector(req.taxonomy_key)

        if not detector:
            # Fall back to generic keyword search
            terms = req.search_terms or [req.name]
            detector = GenericKeywordDetector(keywords=terms)

        signals: list[Signal] = []
        for path, content in files.items():
            sigs = detector.detect(path, content)
            signals.extend(sigs)

        return signals


orchestrator = Orchestrator()
