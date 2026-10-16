"""Test suite validating that all JSON fixtures strictly adhere to Pydantic schemas.

Reference: docs/BRAIN.md (§0.3, §10, §19.1).
"""

import json
from pathlib import Path

from backend.app.schemas import (
    AgentEvent,
    Diff,
    Health,
    JobDraft,
    Status,
    Track,
)

FIXTURES_DIR = Path(__file__).resolve().parent.parent.parent / "docs" / "fixtures"


def test_job_draft_fixture_validates():
    """Verify job_draft.json loads and matches JobDraft schema."""
    path = FIXTURES_DIR / "job_draft.json"
    assert path.exists(), f"Missing fixture: {path}"
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    job = JobDraft.model_validate(data)
    assert job.id == "job_devproof_demo"
    assert len(job.requirements) >= 5


def test_track_assessment_c0_validates():
    """Verify track_assessment_c0.json matches Track schema and C0 demo statuses."""
    path = FIXTURES_DIR / "track_assessment_c0.json"
    assert path.exists(), f"Missing fixture: {path}"
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    track = Track.model_validate(data)
    assert track.id == "track_demo"
    assert track.latest_analysis is not None
    assert track.latest_analysis.commit_sha.startswith("a1b2c3d")

    assessments = track.assessments or (
        track.latest_analysis.assessments if track.latest_analysis else []
    )
    status_map = {a.requirement_id: a.status for a in assessments}
    assert status_map["req_rest_api"] == Status.DEMONSTRATED
    assert status_map["req_sql_database"] == Status.NOT_DEMONSTRATED
    assert status_map["req_testing"] == Status.NOT_DEMONSTRATED
    assert status_map["req_deployment"] == Status.NOT_DEMONSTRATED
    assert status_map["req_python"] == Status.DEMONSTRATED


def test_track_assessment_c2_validates():
    """Verify track_assessment_c2.json matches Track schema and C2 demo statuses."""
    path = FIXTURES_DIR / "track_assessment_c2.json"
    assert path.exists(), f"Missing fixture: {path}"
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    track = Track.model_validate(data)
    assert track.latest_analysis is not None
    assert track.latest_analysis.commit_sha.startswith("c3d4e5f")

    assessments = track.assessments or (
        track.latest_analysis.assessments if track.latest_analysis else []
    )
    status_map = {a.requirement_id: a.status for a in assessments}
    # C2 expectations: REST ✓, SQL ○→✓, Testing ○→◐, Deployment ○, Python ✓
    assert status_map["req_rest_api"] == Status.DEMONSTRATED
    assert status_map["req_sql_database"] == Status.DEMONSTRATED
    assert status_map["req_testing"] == Status.PARTIAL
    assert status_map["req_deployment"] == Status.NOT_DEMONSTRATED
    assert status_map["req_python"] == Status.DEMONSTRATED


def test_diff_c0_c2_validates():
    """Verify diff_c0_c2.json matches Diff schema and delta items."""
    path = FIXTURES_DIR / "diff_c0_c2.json"
    assert path.exists(), f"Missing fixture: {path}"
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    diff = Diff.model_validate(data)
    assert diff.from_sha.startswith("a1b2c3d")
    assert diff.to_sha.startswith("c3d4e5f")
    assert len(diff.items) >= 5

    sql_diff = next(
        item for item in diff.items if item.requirement_id == "req_sql_database"
    )
    assert sql_diff.before_status == Status.NOT_DEMONSTRATED
    assert sql_diff.after_status == Status.DEMONSTRATED
    assert sql_diff.change == "improved"
    assert len(sql_diff.evidence_added) >= 1

    test_diff = next(
        item for item in diff.items if item.requirement_id == "req_testing"
    )
    assert test_diff.before_status == Status.NOT_DEMONSTRATED
    assert test_diff.after_status == Status.PARTIAL
    assert test_diff.change == "improved"


def test_events_fixture_validates():
    """Verify events.json matches list[AgentEvent] schema."""
    path = FIXTURES_DIR / "events.json"
    assert path.exists(), f"Missing fixture: {path}"
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    events = [AgentEvent.model_validate(item) for item in data]
    assert len(events) >= 5
    assert any(e.agent == "Repo Scout" for e in events)
    assert any(e.agent == "Change Sentinel" for e in events)
    assert any(e.agent == "Verifier" for e in events)


def test_health_fixture_validates():
    """Verify health.json matches Health schema."""
    path = FIXTURES_DIR / "health.json"
    assert path.exists(), f"Missing fixture: {path}"
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    health = Health.model_validate(data)
    assert health.llm == "ok"
    assert health.github == "ok"
    assert health.rate_remaining > 0
