"""Tests for Phase BE-2: Orchestrator, Change Sentinel, Impact Map, Diff Builder, and Webhooks.

Reference: docs/PLAN-5H.md (Phase BE-2) and rule 10-engine-invariants.md.
"""

from __future__ import annotations

import hashlib
import hmac
import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.agents.change_sentinel import ChangeSentinel
from backend.app.agents.orchestrator import Orchestrator
from backend.app.config import settings
from backend.app.db import get_db
from backend.app.main import app
from backend.app.models import (
    AnalysisModel,
    AssessmentModel,
    Base,
    JobModel,
    RepoModel,
    RequirementModel,
    TrackModel,
)
from backend.app.schemas import DiffChange, Status
from backend.app.services.diff_builder import build_analysis_diff, compute_status_change
from backend.app.services.impact_map import compute_impact


def create_test_db() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
def db_session() -> Session:
    session_factory = create_test_db()
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session: Session) -> TestClient:
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    test_client = TestClient(app)
    yield test_client
    app.dependency_overrides.clear()


class TestImpactMap:
    def test_readme_and_docs_only_commit(self) -> None:
        files = ["README.md", "docs/architecture.md", "notes.txt"]
        result = compute_impact(files)
        assert result.is_docs_only is True
        assert len(result.affected_keys) == 0
        assert "docs only: no skill change" in result.reason

    def test_sql_and_db_changes(self) -> None:
        files = ["app/db.py", "migrations/001_init.sql"]
        result = compute_impact(files)
        assert result.is_docs_only is False
        assert "sql_database" in result.affected_keys
        assert "python_lang" in result.affected_keys

    def test_test_suite_changes(self) -> None:
        files = ["tests/test_api.py"]
        result = compute_impact(files)
        assert result.is_docs_only is False
        assert "testing" in result.affected_keys

    def test_dockerfile_changes(self) -> None:
        files = ["Dockerfile", "docker-compose.yml"]
        result = compute_impact(files)
        assert result.is_docs_only is False
        assert "deployment" in result.affected_keys

    def test_requirements_txt_is_not_doc(self) -> None:
        files = ["requirements.txt"]
        result = compute_impact(files)
        assert result.is_docs_only is False


class TestDiffBuilder:
    def test_status_upgrade(self) -> None:
        change = compute_status_change(
            before_status=Status.NOT_DEMONSTRATED.value,
            after_status=Status.DEMONSTRATED.value,
        )
        assert change == DiffChange.improved

    def test_status_downgrade(self) -> None:
        change = compute_status_change(
            before_status=Status.DEMONSTRATED.value,
            after_status=Status.NOT_DEMONSTRATED.value,
        )
        assert change == DiffChange.regressed

    def test_unable_to_assess_never_regressed(self) -> None:
        """BRAIN §3 Invariant: failure != gap; UNABLE_TO_ASSESS is never shown as regressed."""
        change = compute_status_change(
            before_status=Status.DEMONSTRATED.value,
            after_status=Status.UNABLE_TO_ASSESS.value,
        )
        assert change != DiffChange.regressed
        assert change == DiffChange.unchanged

    def test_build_analysis_diff_evidence_delta(self) -> None:
        prev = {
            "req_sql": {
                "name": "SQL",
                "status": "NOT_DEMONSTRATED",
                "evidence": [],
            }
        }
        curr = {
            "req_sql": {
                "name": "SQL",
                "status": "DEMONSTRATED",
                "evidence": [
                    {
                        "signal_id": "sig_1",
                        "file_path": "app/db.py",
                        "snippet": "SELECT 1",
                        "strength": "strong",
                    }
                ],
            }
        }
        diff = build_analysis_diff(
            from_sha="sha_old",
            to_sha="sha_new",
            commit_message="feat(db): add sql",
            files_changed=["app/db.py"],
            previous_assessments=prev,
            current_assessments=curr,
            reassessed_req_ids={"req_sql"},
        )
        item = diff["items"][0]
        assert item["change"] == "improved"
        assert len(item["evidence_added"]) == 1
        assert len(item["evidence_removed"]) == 0
        assert "app/db.py" in item["why"]


class TestChangeSentinelAndWebhooks:
    def _generate_signature(self, body: bytes, secret: str) -> str:
        h = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
        return f"sha256={h}"

    def test_hmac_verification_valid_and_invalid(self) -> None:
        sentinel = ChangeSentinel()
        payload = b'{"hello": "world"}'
        secret = "test-secret"
        valid_sig = self._generate_signature(payload, secret)

        assert sentinel.verify_webhook_signature(payload, valid_sig, secret) is True
        assert (
            sentinel.verify_webhook_signature(payload, "sha256=invalid", secret)
            is False
        )
        assert sentinel.verify_webhook_signature(payload, None, secret) is False

    def test_webhook_endpoint_invalid_signature_returns_401(
        self, client: TestClient
    ) -> None:
        response = client.post(
            "/api/webhooks/github",
            content=b'{"ref": "refs/heads/main"}',
            headers={
                "X-Hub-Signature-256": "sha256=badbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadb",
                "X-GitHub-Delivery": "del_1",
                "X-GitHub-Event": "push",
            },
        )
        assert response.status_code == 401
        data = response.json()
        assert data["detail"]["error"]["code"] == "invalid_signature"

    def test_webhook_ping_event(self, client: TestClient) -> None:
        payload = json.dumps(
            {"zen": "Practicality beats purity.", "hook_id": 42}
        ).encode("utf-8")
        sig = self._generate_signature(payload, settings.GITHUB_WEBHOOK_SECRET)

        response = client.post(
            "/api/webhooks/github",
            content=payload,
            headers={
                "X-Hub-Signature-256": sig,
                "X-GitHub-Delivery": "del_ping_1",
                "X-GitHub-Event": "ping",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pong"
        assert data["zen"] == "Practicality beats purity."

    def test_webhook_deduplication(self, client: TestClient) -> None:
        payload = json.dumps({"zen": "Test", "hook_id": 99}).encode("utf-8")
        sig = self._generate_signature(payload, settings.GITHUB_WEBHOOK_SECRET)

        # First request
        res1 = client.post(
            "/api/webhooks/github",
            content=payload,
            headers={
                "X-Hub-Signature-256": sig,
                "X-GitHub-Delivery": "del_dedupe_123",
                "X-GitHub-Event": "ping",
            },
        )
        assert res1.status_code == 200
        assert res1.json()["status"] == "pong"

        # Duplicate request with same delivery ID
        res2 = client.post(
            "/api/webhooks/github",
            content=payload,
            headers={
                "X-Hub-Signature-256": sig,
                "X-GitHub-Delivery": "del_dedupe_123",
                "X-GitHub-Event": "ping",
            },
        )
        assert res2.status_code == 200
        assert res2.json()["status"] == "ignored"
        assert res2.json()["reason"] == "duplicate_delivery"


class TestOrchestratorIdempotencyAndCIUpgrade:
    @pytest.mark.asyncio
    async def test_orchestrator_idempotency(self, db_session: Session) -> None:
        """Analysis for same (track_id, sha) must return existing record without duplicate work."""
        orchestrator = Orchestrator()

        # Seed minimal DB data
        job = JobModel(
            id="job_idemp",
            title="Backend Dev",
            company="Acme",
            source_url="https://example.com/job",
        )
        repo = RepoModel(
            id="repo_idemp",
            owner="testuser",
            name="testrepo",
            html_url="https://github.com/testuser/testrepo",
        )
        track = TrackModel(
            id="track_idemp",
            job_id="job_idemp",
            repo_id="repo_idemp",
            branch="main",
            last_seen_sha="sha_initial",
        )
        db_session.add_all([job, repo, track])
        db_session.commit()

        # Manually create existing completed analysis
        existing_analysis = AnalysisModel(
            id="analysis_existing",
            track_id="track_idemp",
            commit_sha="sha_initial",
            status="complete",
        )
        db_session.add(existing_analysis)
        db_session.commit()

        # Call orchestrator.run_initial_assessment
        result = await orchestrator.run_initial_assessment(
            "track_idemp", "sha_initial", db_session
        )
        assert result.id == "analysis_existing"

    @pytest.mark.asyncio
    async def test_ci_testing_upgrade(self, db_session: Session) -> None:
        """CI check run completion upgrades Testing from PARTIAL to DEMONSTRATED."""
        orchestrator = Orchestrator()

        job = JobModel(
            id="job_ci", title="Dev", company="Corp", source_url="https://example.com"
        )
        req = RequirementModel(
            id="req_test_1",
            job_id="job_ci",
            name="Unit Testing",
            category="QA",
            priority="must",
            source_sentence="Write unit tests.",
            taxonomy_key="testing",
        )
        repo = RepoModel(
            id="repo_ci",
            owner="user",
            name="repo",
            html_url="https://github.com/user/repo",
        )
        track = TrackModel(
            id="track_ci", job_id="job_ci", repo_id="repo_ci", branch="main"
        )
        analysis = AnalysisModel(
            id="analysis_ci",
            track_id="track_ci",
            commit_sha="sha_ci_test",
            status="complete",
        )
        asmt = AssessmentModel(
            id="asmt_test_1",
            analysis_id="analysis_ci",
            requirement_id="req_test_1",
            status=Status.PARTIAL.value,
            strength="moderate",
            summary="Static tests found",
            limitation="No CI run observed yet",
            next_step="Run in CI",
        )
        db_session.add_all([job, req, repo, track, analysis, asmt])
        db_session.commit()

        # Execute CI upgrade
        upgraded = await orchestrator.upgrade_ci_testing(
            "track_ci", "sha_ci_test", db_session
        )
        assert upgraded is True

        # Verify DB state
        db_session.refresh(asmt)
        assert asmt.status == Status.DEMONSTRATED.value
        assert asmt.strength == "strong"
        assert "CI workflow run succeeded" in asmt.limitation
