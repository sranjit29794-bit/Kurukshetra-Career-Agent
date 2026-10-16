"""Diff builder computing status transitions and evidence changes between analyses.

Reference: docs/BRAIN.md (§6.1, §10.4, §16.2) and docs/PLAN-5H.md (Phase BE-2).

Hard Invariants:
1. Status transition must be one of: improved | regressed | unchanged | newly_assessed.
2. UNABLE_TO_ASSESS is never labeled as regressed (failure != gap).
3. If evidence file is deleted, verdict downgrades and why states evidence was removed.
4. Unchanged skills that were not reassessed note: "Not reassessed: no related files changed".
"""

from __future__ import annotations

from typing import Any

from backend.app.schemas import DiffChange, Status

STATUS_RANK: dict[str, int] = {
    Status.NOT_DEMONSTRATED.value: 0,
    Status.PARTIAL.value: 1,
    Status.DEMONSTRATED.value: 2,
    Status.UNABLE_TO_ASSESS.value: 0,
}

STRENGTH_RANK: dict[str, int] = {
    "none": 0,
    "limited": 1,
    "moderate": 2,
    "strong": 3,
}


def compute_status_change(
    before_status: str | None,
    after_status: str,
    before_strength: str = "none",
    after_strength: str = "none",
) -> DiffChange:
    """Determine transition type respecting engine invariants."""
    if before_status is None:
        return DiffChange.newly_assessed

    # Invariant: UNABLE_TO_ASSESS is never treated as a regression
    if (
        after_status == Status.UNABLE_TO_ASSESS.value
        or before_status == Status.UNABLE_TO_ASSESS.value
    ):
        if after_status == before_status:
            return DiffChange.unchanged
        if (
            after_status == Status.DEMONSTRATED.value
            or after_status == Status.PARTIAL.value
        ):
            return DiffChange.improved
        return DiffChange.unchanged

    rank_before = STATUS_RANK.get(before_status, 0)
    rank_after = STATUS_RANK.get(after_status, 0)

    if rank_after > rank_before:
        return DiffChange.improved
    if rank_after < rank_before:
        return DiffChange.regressed

    # Same status: compare strength
    str_before = STRENGTH_RANK.get(before_strength, 0)
    str_after = STRENGTH_RANK.get(after_strength, 0)
    if str_after > str_before:
        return DiffChange.improved
    if str_after < str_before:
        return DiffChange.regressed

    return DiffChange.unchanged


def build_analysis_diff(
    from_sha: str,
    to_sha: str,
    commit_message: str,
    files_changed: list[str],
    previous_assessments: dict[str, dict[str, Any]],
    current_assessments: dict[str, dict[str, Any]],
    reassessed_req_ids: set[str],
) -> dict[str, Any]:
    """Build canonical analysis diff matching docs/fixtures/diff_c0_c2.json."""
    items: list[dict[str, Any]] = []

    all_req_ids = set(previous_assessments.keys()) | set(current_assessments.keys())

    for req_id in sorted(all_req_ids):
        prev = previous_assessments.get(req_id)
        curr = current_assessments.get(req_id)

        name = (curr or prev or {}).get("name", req_id)
        before_status = prev.get("status") if prev else None
        before_strength = prev.get("strength", "none") if prev else "none"

        after_status = (
            curr.get("status", Status.NOT_DEMONSTRATED.value)
            if curr
            else Status.NOT_DEMONSTRATED.value
        )
        after_strength = curr.get("strength", "none") if curr else "none"

        change = compute_status_change(
            before_status, after_status, before_strength, after_strength
        )
        is_reassessed = req_id in reassessed_req_ids

        # Compute added and removed evidence
        prev_ev = prev.get("evidence", []) if prev else []
        curr_ev = curr.get("evidence", []) if curr else []

        prev_sig_ids = {e.get("signal_id") for e in prev_ev if e.get("signal_id")}
        curr_sig_ids = {e.get("signal_id") for e in curr_ev if e.get("signal_id")}

        evidence_added = [e for e in curr_ev if e.get("signal_id") not in prev_sig_ids]
        evidence_removed = [
            e for e in prev_ev if e.get("signal_id") not in curr_sig_ids
        ]

        # Generate honest, human-readable why explanation
        if not is_reassessed:
            why = "Not reassessed — no related files changed in this commit."
        elif change == DiffChange.improved:
            added_files = {
                e.get("file_path") for e in evidence_added if e.get("file_path")
            }
            files_str = ", ".join(sorted(added_files)) if added_files else "commit code"
            why = (
                f"{name} moved {before_status or 'Unassessed'} → {after_status} "
                f"because {files_str} added verified implementation evidence."
            )
        elif change == DiffChange.regressed:
            removed_files = {
                e.get("file_path") for e in evidence_removed if e.get("file_path")
            }
            files_str = (
                ", ".join(sorted(removed_files)) if removed_files else "analyzed files"
            )
            why = (
                f"{name} moved {before_status} → {after_status} "
                f"because previously cited evidence in {files_str} was modified or deleted."
            )
        else:
            why = f"{name} remains {after_status}; analyzed signals maintained consistent coverage."

        items.append(
            {
                "requirement_id": req_id,
                "name": name,
                "before_status": before_status or Status.NOT_DEMONSTRATED.value,
                "after_status": after_status,
                "change": change.value,
                "evidence_added": evidence_added,
                "evidence_removed": evidence_removed,
                "reassessed": is_reassessed,
                "why": why,
            }
        )

    return {
        "from_sha": from_sha,
        "to_sha": to_sha,
        "commit_message": commit_message,
        "files_changed": files_changed,
        "items": items,
    }
