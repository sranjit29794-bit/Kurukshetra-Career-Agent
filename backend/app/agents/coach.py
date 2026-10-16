"""Coach agent synthesizing next steps, actionable recommendations, and diff explanations.

Reference: docs/BRAIN.md (§5, §16.1) and rule 10-engine-invariants.md.

Hard Invariants:
1. Suggestions ("what would raise this") are visually and structurally separate from verified evidence.
2. Invariant language: "Not demonstrated in analyzed scope" (never "student lacks skill").
3. Unchanged skills in diff are clearly stated.
"""

from __future__ import annotations

import logging

from backend.app.schemas import Diff, Status, VerifiedAssessment

logger = logging.getLogger(__name__)


class Coach:
    """Provides constructive recommendations and diff narratives to help candidates raise their evidence rung."""

    def generate_coaching(
        self,
        verified_assessments: list[VerifiedAssessment],
        diff: Diff | None = None,
    ) -> list[VerifiedAssessment]:
        """Enrich verified assessments with contextual coaching next steps and diff notes."""
        diff_item_map = {}
        if diff:
            diff_item_map = {item.requirement_id: item for item in diff.items}

        updated: list[VerifiedAssessment] = []
        for asmt in verified_assessments:
            diff_item = diff_item_map.get(asmt.requirement_id)
            next_step = asmt.next_step

            # If status is NOT_DEMONSTRATED, provide constructive coaching advice
            if asmt.status == Status.NOT_DEMONSTRATED and (
                not next_step or next_step == "None"
            ):
                next_step = (
                    "Suggestion: Implement core logic with unit tests and type annotations "
                    "in your public GitHub repository to demonstrate this skill."
                )

            # If diff available and skill improved
            if diff_item and diff_item.change.value == "improved":
                summary = f"{asmt.summary} (Upgraded from {diff_item.before_status.value} in this commit)"
            else:
                summary = asmt.summary

            asmt_copy = asmt.model_copy(
                update={"summary": summary, "next_step": next_step}
            )
            updated.append(asmt_copy)

        return updated


coach = Coach()
