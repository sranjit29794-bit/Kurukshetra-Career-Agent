"""Evidence Verifier agent validating citations against analyzed commit blob contents.

Reference: docs/BRAIN.md (§3, §5, §10.3) and rule 10-engine-invariants.md.

Hard Invariants:
1. Verifier re-reads every cited range at the analyzed commit SHA content.
2. File missing, lines out of range, or snippet mismatch -> DROP signal -> RECOMPUTE status.
3. DEMONSTRATED requires >= 1 STRONG signal that passed verification.
4. No evidence -> no credit (NOT_DEMONSTRATED).
"""

from __future__ import annotations

import logging
import uuid

from backend.app.schemas import (
    DraftAssessment,
    Evidence,
    RepoSnapshot,
    Signal,
    SignalStrength,
    Status,
    Strength,
    VerifiedAssessment,
)
from backend.app.services.status_rules import decide, enforce_not_upgrade

logger = logging.getLogger(__name__)


class EvidenceVerifier:
    """Verifies that cited signals physically exist and match repository content at the analyzed SHA."""

    def verify_assessments(
        self,
        drafts: list[DraftAssessment],
        snapshot: RepoSnapshot,
        candidate_signals: list[Signal],
        analysis_id: str = "analysis_curr",
    ) -> list[VerifiedAssessment]:
        """Verify each draft assessment against snapshot files, dropping invalid citations."""
        file_map: dict[str, str] = {
            f.path: f.content for f in snapshot.files if f.content is not None
        }
        signal_map: dict[str, Signal] = {s.signal_id: s for s in candidate_signals}

        verified_results: list[VerifiedAssessment] = []

        for draft in drafts:
            verified_evidence: list[Evidence] = []
            verified_signals: list[Signal] = []
            failed_citations: list[str] = []

            for sig_id in draft.cited_signal_ids:
                sig = signal_map.get(sig_id)
                if not sig:
                    failed_citations.append(
                        f"Signal ID {sig_id} not found in retrieved signals"
                    )
                    continue

                # Verify file exists in snapshot
                if sig.file_path not in file_map:
                    failed_citations.append(
                        f"File {sig.file_path} not found in analyzed snapshot"
                    )
                    continue

                content = file_map[sig.file_path]
                lines = content.splitlines()

                # Verify line bounds
                if sig.line_start < 1 or sig.line_start > len(lines):
                    failed_citations.append(
                        f"Line {sig.line_start} out of range (file has {len(lines)} lines)"
                    )
                    continue

                # Verify line content matches snippet
                end_line = min(sig.line_end, len(lines))
                quoted_block = "\n".join(lines[sig.line_start - 1 : end_line])

                # Check if snippet or stripped snippet appears in the quoted block
                stripped_snippet = "\n".join(
                    line.strip() for line in sig.snippet.splitlines() if line.strip()
                )
                stripped_block = "\n".join(
                    line.strip() for line in quoted_block.splitlines() if line.strip()
                )

                if not stripped_snippet or stripped_snippet not in stripped_block:
                    failed_citations.append(
                        f"Snippet mismatch at {sig.file_path}:{sig.line_start}-{sig.line_end}"
                    )
                    continue

                # Citation successfully verified against blob content!
                verified_signals.append(sig)
                evidence = Evidence(
                    id=f"ev_{uuid.uuid4().hex[:12]}",
                    signal_id=sig.signal_id,
                    detector=sig.detector,
                    file_path=sig.file_path,
                    line_start=sig.line_start,
                    line_end=sig.line_end,
                    snippet=sig.snippet,
                    blob_sha=sig.blob_sha,
                    strength=sig.strength,
                    counted=True,
                )
                verified_evidence.append(evidence)

            # Determine taxonomy key from verified signals or requirement ID
            tax_key = None
            if verified_signals:
                tax_key = verified_signals[0].detector
            elif draft.requirement_id:
                tax_key = draft.requirement_id.removeprefix("req_")

            # Recompute status from only verified signals
            new_status, new_strength, new_lims = decide(
                verified_signals, taxonomy_key=tax_key
            )

            # Invariant #1: DEMONSTRATED needs >= 1 STRONG signal that passed verification
            has_strong_verified = any(
                s.strength == SignalStrength.strong for s in verified_signals
            )
            if draft.status == Status.DEMONSTRATED and not has_strong_verified:
                if any(s.strength == SignalStrength.medium for s in verified_signals):
                    new_status = Status.PARTIAL
                    new_strength = Strength.limited
                else:
                    new_status = Status.NOT_DEMONSTRATED
                    new_strength = Strength.none

            # Invariant #2: Cannot upgrade past draft status
            new_status = enforce_not_upgrade(draft.status, new_status)

            # Add notes if citations failed verification
            limitation = draft.limitation
            if failed_citations:
                limitation = (
                    f"Warning: {len(failed_citations)} citation(s) failed validation against commit blob content. "
                    + limitation
                )

            verified_results.append(
                VerifiedAssessment(
                    id=f"asmt_{uuid.uuid4().hex[:12]}",
                    analysis_id=analysis_id,
                    requirement_id=draft.requirement_id,
                    status=new_status,
                    strength=new_strength,
                    summary=draft.summary,
                    limitation=limitation,
                    next_step=draft.next_step,
                    carried_forward=False,
                    reassessed=True,
                    ignored_signals=draft.ignored_signals,
                    ai_used=True,
                    evidence=verified_evidence,
                )
            )

        return verified_results


evidence_verifier = EvidenceVerifier()
