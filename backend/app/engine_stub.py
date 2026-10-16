"""Deterministic stub engine loading results from docs/fixtures.

Enables the watcher, repository, and track lanes (BE lane) to build and test
before the real AST detector engine (EN lane) lands.
Reference: docs/PLAN-5H.md (§1.2, §4, R0).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from backend.app.engine_interface import EngineProtocol
from backend.app.schemas import (
    Diff,
    DraftAssessment,
    JobDraft,
    RepoSnapshot,
    RequirementIn,
    VerifiedAssessment,
)

FIXTURES_DIR = Path(__file__).resolve().parent.parent.parent / "docs" / "fixtures"


class EngineStub(EngineProtocol):
    """Deterministic stub engine powered by verified fixtures (C0, C1, C2)."""

    def __init__(self, fixtures_dir: Path | None = None) -> None:
        self.fixtures_dir = fixtures_dir or FIXTURES_DIR

    def _load_json(self, filename: str) -> Any:
        path = self.fixtures_dir / filename
        if not path.exists():
            raise FileNotFoundError(f"Fixture file not found: {path}")
        return json.loads(path.read_text(encoding="utf-8"))

    async def extract_job(
        self,
        url: str | None = None,
        raw_text: str | None = None,
    ) -> JobDraft:
        """Return deterministic job draft from job_draft.json fixture."""
        data = self._load_json("job_draft.json")
        if url:
            data["source_url"] = url
        if raw_text:
            data["raw_text"] = raw_text
        return JobDraft.model_validate(data)

    async def assess(
        self,
        snapshot: RepoSnapshot,
        requirements: list[RequirementIn],
        only_ids: list[str] | None = None,
    ) -> list[DraftAssessment]:
        """Return draft assessments corresponding to the commit SHA (C0/C1 vs C2)."""
        sha = snapshot.commit_sha.lower()
        is_baseline = sha.startswith(("a1b2c3d", "b2c3d4e"))
        fixture_name = (
            "track_assessment_c0.json" if is_baseline else "track_assessment_c2.json"
        )

        data = self._load_json(fixture_name)
        assessments_raw = data.get("assessments", [])

        target_ids = set(only_ids) if only_ids else {r.id for r in requirements if r.id}

        drafts: list[DraftAssessment] = []
        for item in assessments_raw:
            req_id = item.get("requirement_id")
            if target_ids and req_id not in target_ids:
                continue

            drafts.append(
                DraftAssessment(
                    requirement_id=req_id,
                    status=item.get("status"),
                    strength=item.get("strength", "none"),
                    summary=item.get("summary", ""),
                    limitation=item.get("limitation", ""),
                    next_step=item.get("next_step", ""),
                    cited_signal_ids=[
                        e.get("signal_id")
                        for e in item.get("evidence", [])
                        if "signal_id" in e
                    ],
                    ignored_signals=item.get("ignored_signals", []),
                )
            )
        return drafts

    async def verify(
        self,
        assessments: list[DraftAssessment],
        snapshot: RepoSnapshot,
    ) -> list[VerifiedAssessment]:
        """Convert draft assessments into verified assessments using fixture evidence."""
        sha = snapshot.commit_sha.lower()
        is_baseline = sha.startswith(("a1b2c3d", "b2c3d4e"))
        fixture_name = (
            "track_assessment_c0.json" if is_baseline else "track_assessment_c2.json"
        )

        data = self._load_json(fixture_name)
        fixture_map = {
            item["requirement_id"]: item for item in data.get("assessments", [])
        }

        verified_list: list[VerifiedAssessment] = []
        for draft in assessments:
            raw = fixture_map.get(draft.requirement_id)
            if raw:
                verified_list.append(VerifiedAssessment.model_validate(raw))
            else:
                verified_list.append(
                    VerifiedAssessment(
                        id=f"asmt_{draft.requirement_id}",
                        analysis_id=f"analysis_{snapshot.commit_sha[:7]}",
                        requirement_id=draft.requirement_id,
                        status=draft.status,
                        strength=draft.strength,
                        summary=draft.summary,
                        limitation=draft.limitation,
                        next_step=draft.next_step,
                        carried_forward=False,
                        reassessed=True,
                        ignored_signals=draft.ignored_signals,
                        ai_used=False,
                        evidence=[],
                    )
                )
        return verified_list

    async def coach(
        self,
        verified: list[VerifiedAssessment],
        diff: Diff | None = None,
    ) -> list[VerifiedAssessment]:
        """Return coach-enriched verified assessments."""
        # Stub preserves verified assessments; when diff is present, could enrich why
        return verified
