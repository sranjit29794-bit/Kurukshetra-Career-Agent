"""Status decision rules and invariant enforcement.

Reference: docs/BRAIN.md (§3, §10.1–§10.4) and rule 10-engine-invariants.

Hard Invariants enforced:
1. No evidence -> no credit (DEMONSTRATED requires >= 1 STRONG counted signal).
2. LLM may only downgrade or explain. It can never upgrade past preliminary status.
6. Testing and Deployment are capped at PARTIAL in MVP.
   Unmapped/generic skills are capped at PARTIAL.
7. Weak signals (comments, README claims, assert True, pass) are ignored (counted=False).
"""

from __future__ import annotations

from typing import Any

from backend.app.schemas import Signal, SignalStrength, Status, Strength

_STATUS_RANK: dict[Status, int] = {
    Status.NOT_DEMONSTRATED: 0,
    Status.UNABLE_TO_ASSESS: 0,
    Status.PARTIAL: 1,
    Status.DEMONSTRATED: 2,
}


def decide(
    signals: list[Signal],
    taxonomy_key: str | None = None,
) -> tuple[Status, Strength, list[dict[str, Any]]]:
    """Calculate deterministic preliminary status, confidence strength, and ignored signals list.

    Enforces Invariants #1, #6, #7.
    """
    counted_strong = [
        s for s in signals if s.counted and s.strength == SignalStrength.strong
    ]
    counted_medium = [
        s for s in signals if s.counted and s.strength == SignalStrength.medium
    ]

    # Collect ignored signals for explainer panel (F12)
    ignored_signals: list[dict[str, Any]] = [
        {
            "signal_id": s.signal_id,
            "detector": s.detector,
            "reason": s.reason,
            "file": s.file_path,
            "lines": f"L{s.line_start}-{s.line_end}",
        }
        for s in signals
        if not s.counted or s.strength == SignalStrength.weak
    ]

    # Preliminary status determination
    if counted_strong:
        status = Status.DEMONSTRATED
    elif counted_medium:
        status = Status.PARTIAL
    else:
        status = Status.NOT_DEMONSTRATED

    # Invariant #6: Testing and Deployment are capped at PARTIAL in MVP
    if taxonomy_key in ("testing", "deployment") and status == Status.DEMONSTRATED:
        status = Status.PARTIAL

    # Invariant #6: Unmapped / generic skills are capped at PARTIAL
    if (
        taxonomy_key is None or taxonomy_key == "generic_keyword"
    ) and status == Status.DEMONSTRATED:
        status = Status.PARTIAL

    # Strength calculation per BRAIN §10.4
    distinct_files = {s.file_path for s in counted_strong}
    if len(counted_strong) >= 2 and len(distinct_files) >= 2:
        strength = Strength.strong
    elif len(counted_strong) >= 1 or len(counted_medium) >= 2:
        strength = Strength.moderate
    elif len(counted_medium) == 1:
        strength = Strength.limited
    else:
        strength = Strength.none

    return status, strength, ignored_signals


def enforce_not_upgrade(preliminary: Status, proposed: Status) -> Status:
    """Enforce Invariant #2: LLM can only downgrade or explain, never upgrade past preliminary."""
    prelim_rank = _STATUS_RANK.get(preliminary, 0)
    proposed_rank = _STATUS_RANK.get(proposed, 0)

    if proposed_rank > prelim_rank:
        # Clamped: upgrade rejected
        return preliminary

    return proposed
