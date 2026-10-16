"""End-to-End full stack integration test.

Reference: docs/BRAIN.md (§3, §6, §9, §11, §12, §14, §15) and docs/PLAN-5H.md (Phase G / Phase 9).
Exercises:
1. Job ingestion from real DoorDash text (docs/demo/job_paste.txt) -> POST /api/jobs
2. Resume ingestion from docs/demo/resume_a.pdf and resume_b.pdf -> POST /api/resume/parse
3. Connect repo -> create track -> initial assessment at C0
4. Push C1 via signed webhook -> impact map detects README-only -> no skill changes
5. Push C2 via signed webhook -> SQL flips to DEMONSTRATED, Testing flips to PARTIAL
6. CI check_run success webhook -> Testing upgraded to CI-verified
7. Claims Matrix and Diff validation
"""

from __future__ import annotations

import hashlib
import hmac
import json
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.db import get_db
from backend.app.main import app
from backend.app.models import (
    AnalysisModel,
    RepoModel,
    RequirementModel,
    TrackModel,
)
from backend.app.schemas import (
    Status,
)
from backend.tests.fixtures.loader import load_repo_fixture_snapshot


def compute_webhook_signature(payload_bytes: bytes, secret: str) -> str:
    """Compute HMAC-SHA256 signature header matching GitHub format."""
    signature = hmac.new(
        secret.encode("utf-8"), payload_bytes, hashlib.sha256
    ).hexdigest()
    return f"sha256={signature}"


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def db_session() -> Session:
    return next(get_db())


class TestFullStackIntegrationFlow:
    @pytest.mark.asyncio
    async def test_complete_devproof_pipeline(
        self,
        client: TestClient,
        db_session: Session,
    ) -> None:
        # -------------------------------------------------------------
        # STEP 1: Job Ingestion from real demo paste
        # -------------------------------------------------------------
        job_paste_path = Path("docs/demo/job_paste.txt")
        assert job_paste_path.exists()
        raw_job_text = job_paste_path.read_text(encoding="utf-8")

        extract_resp = client.post(
            "/api/jobs/extract",
            json={"raw_text": raw_job_text},
        )
        assert extract_resp.status_code == 200
        job_draft = extract_resp.json()
        assert job_draft["source_type"] == "user_provided"
        assert len(job_draft["requirements"]) >= 4

        # Save job
        create_job_resp = client.post("/api/jobs", json=job_draft)
        assert create_job_resp.status_code == 200
        saved_job = create_job_resp.json()
        job_id = saved_job["id"]

        # -------------------------------------------------------------
        # STEP 2: Resume Ingestion & Candidate Discovery
        # -------------------------------------------------------------
        resume_a_path = Path("docs/demo/resume_a.pdf")
        with resume_a_path.open("rb") as f:
            resume_resp = client.post(
                "/api/resume/parse",
                files={"file": ("resume_a.pdf", f, "application/pdf")},
            )
        assert resume_resp.status_code == 200
        resume_data = resume_resp.json()
        resume_id = resume_data["resume_id"]
        assert len(resume_data["repo_candidates"]) >= 1
        candidate_repo = resume_data["repo_candidates"][0]
        assert candidate_repo["owner"] == "sranjit29794-bit"
        assert candidate_repo["name"] == "student-api"

        # -------------------------------------------------------------
        # STEP 3: Connect Repo and Create Track
        # -------------------------------------------------------------
        repo_id = f"repo_student_api_{job_id}"
        repo_model = RepoModel(
            id=repo_id,
            owner="sranjit29794-bit",
            name="student-api",
            default_branch="main",
            html_url="https://github.com/sranjit29794-bit/student-api",
            webhook_status="registered",
        )
        db_session.add(repo_model)

        track_id = f"track_{job_id}"
        track_model = TrackModel(
            id=track_id,
            job_id=job_id,
            repo_id=repo_id,
            resume_id=resume_id,
            branch="main",
            last_seen_sha="c000000000000000000000000000000000000000",
            watcher_mode="webhook",
        )
        db_session.add(track_model)
        db_session.commit()

        # -------------------------------------------------------------
        # STEP 4: Initial Assessment at C0
        # -------------------------------------------------------------
        snapshot_c0 = load_repo_fixture_snapshot("student_api", "c0")

        from backend.app.agents.orchestrator import orchestrator

        with patch(
            "backend.app.agents.orchestrator.repo_scout.fetch_snapshot",
            return_value=snapshot_c0,
        ):
            analysis_c0 = await orchestrator.run_initial_assessment(
                track_id=track_id,
                sha="c0000000000000000000000000000000000000000",
                db=db_session,
            )

        assert analysis_c0.status == "complete"
        assert len(analysis_c0.assessments) >= 4

        asmt_map_c0 = {a.requirement_id: a for a in analysis_c0.assessments}
        # Find requirements by taxonomy key
        req_sql = db_session.execute(
            select(RequirementModel).where(
                RequirementModel.job_id == job_id,
                RequirementModel.taxonomy_key == "sql_database",
            )
        ).scalar_one_or_none()
        req_testing = db_session.execute(
            select(RequirementModel).where(
                RequirementModel.job_id == job_id,
                RequirementModel.taxonomy_key == "testing",
            )
        ).scalar_one_or_none()

        assert req_sql is not None
        assert req_testing is not None

        # At C0: SQL and Testing are NOT_DEMONSTRATED
        assert asmt_map_c0[req_sql.id].status == Status.NOT_DEMONSTRATED.value
        assert asmt_map_c0[req_testing.id].status == Status.NOT_DEMONSTRATED.value

        # -------------------------------------------------------------
        # STEP 5: Live Push C1 (Signed Webhook) - README only
        # -------------------------------------------------------------
        c1_payload = {
            "ref": "refs/heads/main",
            "before": "c0000000000000000000000000000000000000000",
            "after": "c1111111111111111111111111111111111111111",
            "repository": {
                "owner": {"login": "sranjit29794-bit"},
                "name": "student-api",
                "html_url": "https://github.com/sranjit29794-bit/student-api",
            },
            "commits": [
                {
                    "id": "c1111111111111111111111111111111111111111",
                    "message": "docs: update README claims",
                    "added": [],
                    "modified": ["README.md"],
                    "removed": [],
                }
            ],
            "head_commit": {
                "id": "c1111111111111111111111111111111111111111",
                "message": "docs: update README claims",
                "added": [],
                "modified": ["README.md"],
                "removed": [],
            },
        }

        c1_bytes = json.dumps(c1_payload).encode("utf-8")
        sig_c1 = compute_webhook_signature(c1_bytes, settings.GITHUB_WEBHOOK_SECRET)

        push_resp_c1 = client.post(
            "/api/webhooks/github",
            content=c1_bytes,
            headers={
                "Content-Type": "application/json",
                "X-GitHub-Event": "push",
                "X-GitHub-Delivery": f"delivery_c1_{job_id}",
                "X-Hub-Signature-256": sig_c1,
            },
        )
        assert push_resp_c1.status_code == 200
        c1_result = push_resp_c1.json()
        assert c1_result["status"] == "processed"

        # Verify C1 did not upgrade any skill
        db_session.expire_all()
        latest_c1_analysis = (
            db_session.execute(
                select(AnalysisModel).where(
                    AnalysisModel.track_id == track_id,
                    AnalysisModel.commit_sha
                    == "c1111111111111111111111111111111111111111",
                )
            )
            .scalars()
            .first()
        )
        assert latest_c1_analysis is not None
        asmt_map_c1 = {a.requirement_id: a for a in latest_c1_analysis.assessments}
        assert asmt_map_c1[req_sql.id].status == Status.NOT_DEMONSTRATED.value
        assert asmt_map_c1[req_testing.id].status == Status.NOT_DEMONSTRATED.value

        # -------------------------------------------------------------
        # STEP 6: Live Push C2 (Signed Webhook) - Added DB + tests
        # -------------------------------------------------------------
        snapshot_c2 = load_repo_fixture_snapshot("student_api", "c2")

        c2_payload = {
            "ref": "refs/heads/main",
            "before": "c1111111111111111111111111111111111111111",
            "after": "c2222222222222222222222222222222222222222",
            "repository": {
                "owner": {"login": "sranjit29794-bit"},
                "name": "student-api",
                "html_url": "https://github.com/sranjit29794-bit/student-api",
            },
            "commits": [
                {
                    "id": "c2222222222222222222222222222222222222222",
                    "message": "feat(db): add sqlite database and tests",
                    "added": ["app/db.py", "tests/test_api.py"],
                    "modified": ["app/main.py"],
                    "removed": [],
                }
            ],
            "head_commit": {
                "id": "c2222222222222222222222222222222222222222",
                "message": "feat(db): add sqlite database and tests",
                "added": ["app/db.py", "tests/test_api.py"],
                "modified": ["app/main.py"],
                "removed": [],
            },
        }

        c2_bytes = json.dumps(c2_payload).encode("utf-8")
        sig_c2 = compute_webhook_signature(c2_bytes, settings.GITHUB_WEBHOOK_SECRET)

        with patch(
            "backend.app.agents.orchestrator.repo_scout.fetch_snapshot",
            return_value=snapshot_c2,
        ):
            push_resp_c2 = client.post(
                "/api/webhooks/github",
                content=c2_bytes,
                headers={
                    "Content-Type": "application/json",
                    "X-GitHub-Event": "push",
                    "X-GitHub-Delivery": f"delivery_c2_{job_id}",
                    "X-Hub-Signature-256": sig_c2,
                },
            )

        assert push_resp_c2.status_code == 200
        db_session.expire_all()
        latest_c2_analysis = (
            db_session.execute(
                select(AnalysisModel).where(
                    AnalysisModel.track_id == track_id,
                    AnalysisModel.commit_sha
                    == "c2222222222222222222222222222222222222222",
                )
            )
            .scalars()
            .first()
        )
        assert latest_c2_analysis is not None
        asmt_map_c2 = {a.requirement_id: a for a in latest_c2_analysis.assessments}

        # SQL flipped to DEMONSTRATED!
        assert asmt_map_c2[req_sql.id].status == Status.DEMONSTRATED.value
        # Testing flipped to PARTIAL (static analysis cap)!
        assert asmt_map_c2[req_testing.id].status == Status.PARTIAL.value

        # -------------------------------------------------------------
        # STEP 7: CI Check Run Success -> Testing upgraded to CI-verified
        # -------------------------------------------------------------
        check_run_payload = {
            "repository": {
                "owner": {"login": "sranjit29794-bit"},
                "name": "student-api",
            },
            "check_run": {
                "status": "completed",
                "conclusion": "success",
                "head_sha": "c2222222222222222222222222222222222222222",
                "name": "pytest",
            },
        }
        cr_bytes = json.dumps(check_run_payload).encode("utf-8")
        sig_cr = compute_webhook_signature(cr_bytes, settings.GITHUB_WEBHOOK_SECRET)

        cr_resp = client.post(
            "/api/webhooks/github",
            content=cr_bytes,
            headers={
                "Content-Type": "application/json",
                "X-GitHub-Event": "check_run",
                "X-GitHub-Delivery": f"delivery_cr_{job_id}",
                "X-Hub-Signature-256": sig_cr,
            },
        )
        assert cr_resp.status_code == 200
        assert cr_resp.json()["status"] == "processed"
        assert cr_resp.json()["upgraded_tracks"] >= 1

        # Check upgraded status in DB
        db_session.expire_all()
        analysis_ci = (
            db_session.execute(
                select(AnalysisModel).where(
                    AnalysisModel.track_id == track_id,
                    AnalysisModel.commit_sha
                    == "c2222222222222222222222222222222222222222",
                )
            )
            .scalars()
            .first()
        )
        asmt_ci_map = {a.requirement_id: a for a in analysis_ci.assessments}
        # Testing is now DEMONSTRATED via CI verification!
        assert asmt_ci_map[req_testing.id].status == Status.DEMONSTRATED.value
        assert "ci" in asmt_ci_map[req_testing.id].summary.lower()
        assert "verified" in asmt_ci_map[req_testing.id].summary.lower()

        # -------------------------------------------------------------
        # STEP 8: Claims Matrix Verification
        # -------------------------------------------------------------
        matrix_resp = client.get(f"/api/jobs/{job_id}/claims-matrix")
        assert matrix_resp.status_code == 200
        matrix = matrix_resp.json()
        assert matrix["job_id"] == job_id
        assert len(matrix["repos"]) >= 1
        assert len(matrix["rows"]) >= 4

        # -------------------------------------------------------------
        # STEP 9: Diff Builder Verification
        # -------------------------------------------------------------
        diff_resp = client.get(f"/api/tracks/{track_id}/diff")
        assert diff_resp.status_code == 200
        diff_data = diff_resp.json()
        assert "items" in diff_data
        improved_skills = [
            item["name"] for item in diff_data["items"] if item["change"] == "improved"
        ]
        assert len(improved_skills) >= 1
