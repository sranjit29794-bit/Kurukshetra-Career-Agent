"""Property and invariant unit tests for status rules.

Reference: docs/BRAIN.md (§3, §10, §17) and rule 10-engine-invariants.
"""

from __future__ import annotations

from backend.app.schemas import Signal, SignalStrength, Status, Strength
from backend.app.services.status_rules import decide, enforce_not_upgrade


def _make_signal(
    detector: str, strength: SignalStrength, counted: bool = True
) -> Signal:
    return Signal(
        signal_id=f"sig_{detector}_{strength.value}_{counted}",
        detector=detector,
        strength=strength,
        file_path="app/test.py",
        line_start=1,
        line_end=5,
        snippet="code snippet",
        blob_sha="blob_123",
        reason="test reason",
        counted=counted,
    )


def test_only_weak_signals_never_exceed_not_demonstrated():
    """Property test: any set of weak/ignored signals must ALWAYS result in NOT_DEMONSTRATED."""
    weak_signals = [
        _make_signal("sql_database", SignalStrength.weak, counted=False),
        _make_signal("testing", SignalStrength.weak, counted=False),
        _make_signal("rest_api", SignalStrength.weak, counted=False),
    ]
    status, strength, ignored = decide(weak_signals, taxonomy_key="sql_database")
    assert status == Status.NOT_DEMONSTRATED
    assert strength == Strength.none
    assert len(ignored) == 3


def test_testing_and_deployment_never_exceed_partial():
    """Invariant #6: Testing and Deployment statuses are capped at PARTIAL in MVP."""
    strong_testing = [_make_signal("testing", SignalStrength.strong, counted=True)]
    status, strength, _ = decide(strong_testing, taxonomy_key="testing")
    assert status == Status.PARTIAL

    strong_deployment = [
        _make_signal("deployment", SignalStrength.strong, counted=True)
    ]
    status, strength, _ = decide(strong_deployment, taxonomy_key="deployment")
    assert status == Status.PARTIAL


def test_unmapped_skill_never_exceeds_partial():
    """Invariant #6: Unmapped skills without dedicated detector are capped at PARTIAL."""
    generic_strong = [
        _make_signal("generic_keyword", SignalStrength.strong, counted=True)
    ]
    status, strength, _ = decide(generic_strong, taxonomy_key=None)
    assert status == Status.PARTIAL


def test_no_evidence_no_credit():
    """Invariant #1: DEMONSTRATED requires >= 1 strong verified signal."""
    medium_only = [_make_signal("sql_database", SignalStrength.medium, counted=True)]
    status, strength, _ = decide(medium_only, taxonomy_key="sql_database")
    assert status == Status.PARTIAL

    no_signals: list[Signal] = []
    status, strength, _ = decide(no_signals, taxonomy_key="sql_database")
    assert status == Status.NOT_DEMONSTRATED


def test_enforce_not_upgrade_clamps():
    """Invariant #2: LLM can only downgrade or explain, never upgrade past preliminary status."""
    # Attempt upgrade from NOT_DEMONSTRATED to PARTIAL -> clamped
    clamped = enforce_not_upgrade(Status.NOT_DEMONSTRATED, Status.PARTIAL)
    assert clamped == Status.NOT_DEMONSTRATED

    # Attempt upgrade from NOT_DEMONSTRATED to DEMONSTRATED -> clamped
    clamped = enforce_not_upgrade(Status.NOT_DEMONSTRATED, Status.DEMONSTRATED)
    assert clamped == Status.NOT_DEMONSTRATED

    # Attempt upgrade from PARTIAL to DEMONSTRATED -> clamped
    clamped = enforce_not_upgrade(Status.PARTIAL, Status.DEMONSTRATED)
    assert clamped == Status.PARTIAL

    # Downgrade from DEMONSTRATED to PARTIAL -> allowed
    downgrade = enforce_not_upgrade(Status.DEMONSTRATED, Status.PARTIAL)
    assert downgrade == Status.PARTIAL

    # Same status -> preserved
    assert (
        enforce_not_upgrade(Status.DEMONSTRATED, Status.DEMONSTRATED)
        == Status.DEMONSTRATED
    )
