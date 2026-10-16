import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.schemas import (
    AgentEvent,
    AnalysisDetail,
    AnalysisStatus,
    AssessmentStatus,
    DiffResponse,
    JobDraft,
    RepoConnectResult,
    SignalStrength,
    Trigger,
)

FIXTURES_DIR = Path(__file__).resolve().parents[2] / "docs" / "fixtures"
client = TestClient(app)


def test_job_draft_fixture_validates():
    path = FIXTURES_DIR / "job_draft.json"
    assert path.exists()
    data = json.loads(path.read_text(encoding="utf-8"))
    job_draft = JobDraft.model_validate(data)
    assert job_draft.title == "Backend Engineering Intern"
    assert len(job_draft.requirements) == 5
    assert job_draft.source_type == "fetched"


def test_repo_connect_fixture_validates():
    path = FIXTURES_DIR / "repo_connect.json"
    assert path.exists()
    data = json.loads(path.read_text(encoding="utf-8"))
    repo = RepoConnectResult.model_validate(data)
    assert repo.owner == "rohan-dev"
    assert repo.name == "student-api"
    assert repo.scope.analyzed == 42
    assert repo.scope.skipped == 118
    assert repo.webhook_status == "registered"


def test_assessment_fixture_validates():
    path = FIXTURES_DIR / "assessment.json"
    assert path.exists()
    data = json.loads(path.read_text(encoding="utf-8"))
    analysis = AnalysisDetail.model_validate(data)
    assert analysis.commit_sha.startswith("a1b2c3d")
    assert analysis.status == AnalysisStatus.COMPLETE
    assert analysis.trigger == Trigger.MANUAL
    assert len(analysis.assessments) == 5

    # Check fixed status enums
    statuses = {a.status for a in analysis.assessments}
    assert AssessmentStatus.DEMONSTRATED in statuses
    assert AssessmentStatus.NOT_DEMONSTRATED in statuses

    # Check evidence items
    demo_assessments = [a for a in analysis.assessments if a.status == AssessmentStatus.DEMONSTRATED]
    assert len(demo_assessments) > 0
    assert len(demo_assessments[0].evidence) > 0
    assert demo_assessments[0].evidence[0].strength == SignalStrength.STRONG


def test_diff_fixture_validates():
    path = FIXTURES_DIR / "diff.json"
    assert path.exists()
    data = json.loads(path.read_text(encoding="utf-8"))
    diff = DiffResponse.model_validate(data)
    assert diff.from_sha.startswith("a1b2c3d")
    assert diff.to_sha.startswith("c2d3e4f")
    assert len(diff.items) == 5
    assert diff.reassessed_count == 4
    assert diff.carried_forward_count == 1

    # Check status transition
    sql_item = next(item for item in diff.items if item.name == "SQL & Relational Databases")
    assert sql_item.before_status == AssessmentStatus.NOT_DEMONSTRATED
    assert sql_item.after_status == AssessmentStatus.DEMONSTRATED
    assert sql_item.change == "improved"


def test_agent_events_fixture_validates():
    path = FIXTURES_DIR / "agent_events.json"
    assert path.exists()
    data = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(data, list)
    events = [AgentEvent.model_validate(item) for item in data]
    assert len(events) == 8
    agents = {e.agent for e in events}
    assert "Orchestrator" in agents
    assert "Repo Scout" in agents
    assert "Evidence Analyst" in agents
    assert "Verifier" in agents
    assert "Coach" in agents


def test_dev_contracts_endpoint():
    response = client.get("/api/dev/contracts")
    assert response.status_code == 200
    payload = response.json()
    assert payload["contracts_valid"] is True
    assert "job_draft" in payload
    assert "repo_connect" in payload
    assert "assessment" in payload
    assert "diff" in payload
    assert "agent_events" in payload
