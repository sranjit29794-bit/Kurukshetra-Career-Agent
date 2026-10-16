"""Production Engine Facade integrating Detectors, Status Rules, Judge, Verifier, and Coach.

Reference: docs/BRAIN.md (§3, §5, §10, §14) and docs/PLAN-5H.md (Phase EN-2).

Hard Invariants:
1. No evidence -> no credit.
2. LLM can only downgrade or explain; it never upgrades preliminary status.
3. Citations are verified against commit blob content; mismatches are dropped.
4. Testing and Deployment are capped at PARTIAL.
5. Missing evidence is always reported as "not demonstrated in analyzed scope".
"""

from __future__ import annotations

import logging

from backend.app.agents.coach import coach
from backend.app.agents.evidence_judge import evidence_judge
from backend.app.agents.evidence_verifier import evidence_verifier
from backend.app.engine_interface import EngineProtocol
from backend.app.schemas import (
    Diff,
    DraftAssessment,
    JobDraft,
    RepoSnapshot,
    RequirementIn,
    Signal,
    VerifiedAssessment,
)

logger = logging.getLogger(__name__)


class EngineFacade(EngineProtocol):
    """Full production engine implementing the EngineProtocol."""

    def __init__(self) -> None:
        self.cached_signals: list[Signal] = []

    async def extract_job(
        self,
        url: str | None = None,
        raw_text: str | None = None,
    ) -> JobDraft:
        """Extract structured requirements from job URL or pasted text."""
        from backend.app.services.job_extractor import extract_job_posting

        return await extract_job_posting(url=url, raw_text=raw_text)

    async def assess(
        self,
        snapshot: RepoSnapshot,
        requirements: list[RequirementIn],
        only_ids: list[str] | None = None,
    ) -> list[DraftAssessment]:
        """Analyze repository files against requirements using deterministic AST detectors and Judge."""
        drafts: list[DraftAssessment] = []
        all_signals: list[Signal] = []

        reqs_to_assess = [
            req
            for req in requirements
            if only_ids is None or (req.id and req.id in only_ids)
        ]

        for req in reqs_to_assess:
            signals = evidence_judge.run_detectors(req, snapshot)
            all_signals.extend(signals)

            draft = await evidence_judge.judge_requirement(req, signals, snapshot)
            drafts.append(draft)

        self.cached_signals = all_signals
        return drafts

    async def verify(
        self,
        assessments: list[DraftAssessment],
        snapshot: RepoSnapshot,
    ) -> list[VerifiedAssessment]:
        """Adversarially verify cited signals against repository blob content at analyzed SHA."""
        return evidence_verifier.verify_assessments(
            drafts=assessments,
            snapshot=snapshot,
            candidate_signals=self.cached_signals,
        )

    async def coach(
        self,
        verified: list[VerifiedAssessment],
        diff: Diff | None = None,
    ) -> list[VerifiedAssessment]:
        """Synthesize actionable coach recommendations, honest limitations, and diff notes."""
        return coach.generate_coaching(verified, diff)


engine_facade = EngineFacade()
