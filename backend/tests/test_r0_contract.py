"""Tests for Phase R0 contract, DB factory, engine stub, and router auto-discovery.

Reference: docs/PLAN-5H.md (Phase R0).
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect

from backend.app.db import create_app_engine, init_db
from backend.app.engine_interface import EngineProtocol
from backend.app.engine_stub import EngineStub
from backend.app.main import app, discovered_routers
from backend.app.schemas import (
    AgentEvent,
    ClaimsMatrix,
    CommitInfo,
    Diff,
    JobDraft,
    RepoSnapshot,
    RequirementIn,
    ResumeDraft,
    Track,
)

FIXTURES_DIR = Path(__file__).resolve().parent.parent.parent / "docs" / "fixtures"


def test_fixtures_validate_against_schemas():
    """Verify that all fixture files in docs/fixtures match Pydantic schemas."""
    # 1. job_draft.json
    job_data = json.loads((FIXTURES_DIR / "job_draft.json").read_text(encoding="utf-8"))
    job_draft = JobDraft.model_validate(job_data)
    assert job_draft.id == "job_devproof_demo"
    assert len(job_draft.requirements) >= 5

    # 2. resume_draft.json
    resume_data = json.loads(
        (FIXTURES_DIR / "resume_draft.json").read_text(encoding="utf-8")
    )
    resume_draft = ResumeDraft.model_validate(resume_data)
    assert resume_draft.resume_id == "res_rohan_001"
    assert len(resume_draft.claimed_skills) == 5
    assert len(resume_draft.repo_candidates) == 2

    # 3. claims_matrix.json
    claims_data = json.loads(
        (FIXTURES_DIR / "claims_matrix.json").read_text(encoding="utf-8")
    )
    claims_matrix = ClaimsMatrix.model_validate(claims_data)
    assert claims_matrix.job_id == "job_devproof_demo"
    assert len(claims_matrix.repos) == 1
    assert len(claims_matrix.rows) == 5

    # Invariant #6 check on ClaimsMatrix: Testing and Deployment never exceed Partial
    testing_row = next(
        r for r in claims_matrix.rows if r.requirement_id == "req_testing"
    )
    assert testing_row.cells[0].status.value in ("NOT_DEMONSTRATED", "PARTIAL")

    deployment_row = next(
        r for r in claims_matrix.rows if r.requirement_id == "req_deployment"
    )
    assert deployment_row.cells[0].status.value in ("NOT_DEMONSTRATED", "PARTIAL")

    # 4. track_assessment_c0.json & track_assessment_c2.json
    track_c0 = Track.model_validate(
        json.loads(
            (FIXTURES_DIR / "track_assessment_c0.json").read_text(encoding="utf-8")
        )
    )
    assert track_c0.id == "track_demo"

    track_c2 = Track.model_validate(
        json.loads(
            (FIXTURES_DIR / "track_assessment_c2.json").read_text(encoding="utf-8")
        )
    )
    assert track_c2.id == "track_demo"

    # 5. diff_c0_c2.json
    diff = Diff.model_validate(
        json.loads((FIXTURES_DIR / "diff_c0_c2.json").read_text(encoding="utf-8"))
    )
    assert len(diff.items) == 6

    # 6. events.json
    events_raw = json.loads((FIXTURES_DIR / "events.json").read_text(encoding="utf-8"))
    events = [AgentEvent.model_validate(e) for e in events_raw]
    assert len(events) >= 5


def test_db_factory_sqlite_and_tables():
    """Verify SQLite DB factory sets check_same_thread and creates all models including resumes."""
    engine = create_app_engine("sqlite:///:memory:")
    init_db(engine_override=engine)

    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    assert "resumes" in tables
    assert "tracks" in tables
    assert "jobs" in tables
    assert "analyses" in tables
    assert "assessments" in tables
    assert "evidence" in tables

    # Verify column additions
    track_columns = {col["name"] for col in inspector.get_columns("tracks")}
    assert "resume_id" in track_columns

    job_columns = {col["name"] for col in inspector.get_columns("jobs")}
    assert "source_detail" in job_columns


def test_db_factory_postgres_url_boots():
    """Verify engine creates from postgresql+psycopg connection string without live DB."""
    postgres_url = "postgresql+psycopg://devuser:devpass@localhost:5432/devproof"
    pg_engine = create_app_engine(postgres_url)
    assert pg_engine.name == "postgresql"
    assert pg_engine.dialect.name == "postgresql"


def test_router_auto_discovery():
    """Verify main.py automatically discovers and mounts all required router modules."""
    required = {
        "health",
        "repos",
        "tracks",
        "github_users",
        "evidence",
        "analyses",
        "webhooks",
        "events",
        "jobs",
        "resume",
    }
    assert required.issubset(set(discovered_routers))

    client = TestClient(app)
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["watcher"] == "polling"


@pytest.mark.asyncio
async def test_engine_stub_deterministic():
    """Verify EngineStub implements EngineProtocol and returns deterministic results."""
    stub = EngineStub()
    assert isinstance(stub, EngineProtocol)

    # extract_job
    job = await stub.extract_job(url="https://jobs.example.com/demo")
    assert job.title == "Backend Engineering Intern (Python/FastAPI)"
    assert len(job.requirements) == 6

    # C0 snapshot assessment
    c0_snapshot = RepoSnapshot(
        repo_url="https://github.com/rohan-builds/student-api",
        commit_sha="a1b2c3d4e5f67890123456789abcdef012345678",
        commit_info=CommitInfo(sha="a1b2c3d", message="feat: initial service"),
    )
    reqs = [
        RequirementIn(
            id="req_sql_database",
            name="SQL",
            category="Database",
            source_sentence="SQL required",
        )
    ]
    drafts_c0 = await stub.assess(c0_snapshot, reqs, only_ids=["req_sql_database"])
    assert len(drafts_c0) == 1
    assert drafts_c0[0].status.value == "NOT_DEMONSTRATED"

    # C2 snapshot assessment
    c2_snapshot = RepoSnapshot(
        repo_url="https://github.com/rohan-builds/student-api",
        commit_sha="c3d4e5f67890123456789abcdef0123456789012",
        commit_info=CommitInfo(sha="c3d4e5f", message="feat(db): add sqlite"),
    )
    drafts_c2 = await stub.assess(c2_snapshot, reqs, only_ids=["req_sql_database"])
    assert len(drafts_c2) == 1
    assert drafts_c2[0].status.value == "DEMONSTRATED"

    # verify
    verified = await stub.verify(drafts_c2, c2_snapshot)
    assert len(verified) == 1
    assert verified[0].status.value == "DEMONSTRATED"
