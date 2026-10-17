"""Evidence Judge agent evaluating detected signals against requirements.

Reference: docs/BRAIN.md (§3, §5, §10.3) and rule 10-engine-invariants.md.

Hard Invariants:
1. Deterministic preliminary status is strictly computed first.
2. LLM can only downgrade or explain; it can NEVER upgrade past the deterministic preliminary status.
3. LLM outputs cited_signal_ids only; it never writes file paths or line numbers.
4. If LLM is disabled or fails, falls back cleanly to deterministic assessment (ai_used=false).
5. Untrusted content is wrapped in <<<DATA ... DATA>>> fences with prompt injection detection.
"""

from __future__ import annotations

import logging

from pydantic import BaseModel, Field

from backend.app.detectors.base import BaseDetector
from backend.app.detectors.generic_keyword import GenericKeywordDetector
from backend.app.detectors.registry import get_detector
from backend.app.events import event_bus
from backend.app.llm.client import llm_client
from backend.app.llm.fallback import (
    generate_deterministic_explanation,
    generate_deterministic_limitations,
    generate_deterministic_next_steps,
)
from backend.app.llm.prompts import (
    PROMPT_JUDGE_EVIDENCE_V1,
    SYSTEM_INJECTION_SHIELD,
    wrap_untrusted,
)
from backend.app.schemas import (
    DraftAssessment,
    RepoSnapshot,
    RequirementIn,
    Signal,
    Status,
)
from backend.app.services.status_rules import decide, enforce_not_upgrade

logger = logging.getLogger(__name__)


class LLMReviewOutput(BaseModel):
    """Schema for LLM evidence review responses."""

    status: Status
    reasoning: str = ""
    summary: str = ""
    limitations: list[str] = Field(default_factory=list)
    cited_signal_ids: list[str] = Field(default_factory=list)


class EvidenceJudge:
    """Evaluates candidate code implementations against job requirements."""

    async def judge_requirement(
        self,
        requirement: RequirementIn,
        signals: list[Signal],
        snapshot: RepoSnapshot,
        track_id: str = "",
    ) -> DraftAssessment:
        """Evaluate signals for a requirement, applying status rules and optional LLM review."""
        req_id = requirement.id or f"req_{requirement.taxonomy_key or 'custom'}"

        # 1. Deterministic preliminary status calculation
        preliminary_status, preliminary_strength, ignored_signals = decide(
            signals, requirement.taxonomy_key
        )

        valid_signal_map = {s.signal_id: s for s in signals if s.counted}
        cited_ids = list(valid_signal_map.keys())

        # 2. Try LLM review if enabled
        final_status = preliminary_status
        final_strength = preliminary_strength
        summary = ""
        limitations: list[str] = []

        if llm_client.enabled and llm_client.api_key and not llm_client.is_degraded:
            try:
                # Format signals summary for prompt
                signals_str = "\n".join(
                    f"- ID: {s.signal_id} | File: {s.file_path}:{s.line_start}-{s.line_end} | "
                    f"Detector: {s.detector} | Strength: {s.strength.value}\n  Snippet: {s.snippet[:150]}"
                    for s in signals
                    if s.counted
                )
                if not signals_str:
                    signals_str = "(No counted signals found)"

                # Concatenate key code snippets with untrusted wrapping
                code_samples = "\n\n".join(
                    f"File: {f.path}\n{f.content[:2000] if f.content else ''}"
                    for f in snapshot.files
                    if f.path.endswith((".py", "Dockerfile", ".sql", ".yml", ".yaml"))
                )[:8000]

                wrapped_code, has_injection = wrap_untrusted(code_samples, "DATA")
                if has_injection:
                    event_bus.emit(
                        agent="EvidenceJudge",
                        message=f"Ignored embedded instruction detected in candidate repository files for {req_id}",
                        level="warn",
                        track_id=track_id,
                    )

                prompt_user = PROMPT_JUDGE_EVIDENCE_V1.format(
                    requirement_title=requirement.name,
                    taxonomy_key=requirement.taxonomy_key or "general",
                    is_required=requirement.priority.value == "must",
                    preliminary_status=preliminary_status.value,
                    signals_data=signals_str,
                    untrusted_repo_content=wrapped_code,
                )

                review = await llm_client.complete_json(
                    system=SYSTEM_INJECTION_SHIELD,
                    user=prompt_user,
                    schema=LLMReviewOutput,
                    track_id=track_id,
                )

                # Invariant #2: LLM can NEVER upgrade past deterministic preliminary status
                safe_status = enforce_not_upgrade(preliminary_status, review.status)
                final_status = safe_status

                # Invariant #3: LLM can only cite provided signal_ids
                valid_cited = [
                    sid for sid in review.cited_signal_ids if sid in valid_signal_map
                ]
                if valid_cited:
                    cited_ids = valid_cited

                summary = review.summary
                if review.limitations:
                    limitations.extend(review.limitations)
            except Exception as err:
                logger.info(
                    "LLM judge review skipped/failed (%s); using deterministic evaluation.",
                    err,
                )

        # Fallback to deterministic generation if LLM was not used or failed
        if not summary:
            summary = generate_deterministic_explanation(
                final_status, requirement.name, signals
            )

        auto_lims = generate_deterministic_limitations(
            final_status, requirement.taxonomy_key, signals
        )
        for lim in auto_lims:
            if lim not in limitations:
                limitations.append(lim)

        next_steps = generate_deterministic_next_steps(
            final_status, requirement.taxonomy_key
        )

        return DraftAssessment(
            requirement_id=req_id,
            status=final_status,
            strength=final_strength,
            summary=summary,
            limitation="; ".join(limitations) if limitations else "None noted.",
            next_step="; ".join(next_steps) if next_steps else "None",
            cited_signal_ids=cited_ids,
            ignored_signals=ignored_signals,
        )

    def run_detectors(
        self,
        requirement: RequirementIn,
        snapshot: RepoSnapshot,
    ) -> list[Signal]:
        """Run appropriate AST detectors for a requirement across snapshot files."""
        detector: BaseDetector | None = None
        if requirement.taxonomy_key:
            detector = get_detector(requirement.taxonomy_key)

        if not detector:
            terms = requirement.search_terms or [requirement.name]
            detector = GenericKeywordDetector(search_terms=terms)

        signals: list[Signal] = []
        for f in snapshot.files:
            if f.content is not None:
                sigs = detector.detect(f.path, f.content)
                signals.extend(sigs)

        return signals


evidence_judge = EvidenceJudge()
