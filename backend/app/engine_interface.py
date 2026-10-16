"""Engine interface Protocol.

Reference: docs/BRAIN.md (§3, §5) and docs/PLAN-5H.md (§1.2, §4, R0).
"""

from typing import Protocol, runtime_checkable

from backend.app.schemas import (
    Diff,
    DraftAssessment,
    JobDraft,
    RepoSnapshot,
    RequirementIn,
    VerifiedAssessment,
)


@runtime_checkable
class EngineProtocol(Protocol):
    """Protocol declaring core engine capabilities for job extraction, assessment, verification, and coaching."""

    async def extract_job(
        self,
        url: str | None = None,
        raw_text: str | None = None,
    ) -> JobDraft:
        """Extract structured requirements from a job URL or raw text."""
        ...

    async def assess(
        self,
        snapshot: RepoSnapshot,
        requirements: list[RequirementIn],
        only_ids: list[str] | None = None,
    ) -> list[DraftAssessment]:
        """Analyze repository snapshot against requirements, returning preliminary draft assessments."""
        ...

    async def verify(
        self,
        assessments: list[DraftAssessment],
        snapshot: RepoSnapshot,
    ) -> list[VerifiedAssessment]:
        """Adversarially verify cited signals against repository blob content, applying invariants."""
        ...

    async def coach(
        self,
        verified: list[VerifiedAssessment],
        diff: Diff | None = None,
    ) -> list[VerifiedAssessment]:
        """Synthesize human-friendly summaries, limitations, next steps, and diff explanations."""
        ...
