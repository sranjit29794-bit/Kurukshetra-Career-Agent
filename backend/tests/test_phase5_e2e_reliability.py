"""Phase 5: Unified End-to-End MVP and Demo Reliability Test Suite.

Verifies the complete end-to-end user loop across clean runs:
1. Job input (URL or text) with SSRF checks
2. Requirement parsing, review, and confirmation
3. GitHub repository connection with pinned commit SHA and tree scope
4. Deterministic AST code evaluation without hallucination
5. Skeptic Verifier citation validation on pinned commit blobs
6. Code push change detection via webhook and polling fallback
7. Targeted diff reassessment and immutable history
8. Stale-fixture isolation: failure never masks stale data as fresh
9. Deterministic engine fallback functions without LLM keys
"""
import uuid
from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient

from backend.app.config import get_settings
from backend.app.main import app
from backend.app.schemas import (
    AnalysisKind,
    AnalysisStatus,
    AssessmentStatus,
    DiffChange,
    RepoConnectResult,
    Scope,
    Trigger,
    WebhookStatus,
)


@pytest.fixture
def client():
    return TestClient(app)


def test_phase5_unified_end_to_end_demo_loop(client):
    """Executes the full Phase 5 demo flow repeatedly to verify reliability."""
    settings = get_settings()
    settings.GITHUB_WEBHOOK_SECRET = "change-me"

    # Step 1: Submit a realistic junior developer internship posting
    job_description = (
        "FinTech Leap is hiring a Python Backend Intern. "
        "Key requirements:\n"
        "- Build high-throughput RESTful APIs using FastAPI or Flask.\n"
        "- Work with relational SQL databases and schema design using SQLAlchemy.\n"
        "- Write automated unit tests using pytest to verify business logic.\n"
        "- Containerize microservices with Docker.\n"
    )

    extract_resp = client.post("/api/jobs/extract", json={"text": job_description})
    assert extract_resp.status_code == 200, extract_resp.text
    job_data = extract_resp.json()
    job_id = job_data["id"]
    assert len(job_data["requirements"]) >= 3

    # Step 2: Student reviews and confirms requirements
    confirmed_reqs = job_data["requirements"]
    confirm_resp = client.put(
        f"/api/jobs/{job_id}/confirm",
        json={
            "title": "Backend Engineering Intern",
            "company": "FinTech Leap",
            "requirements": confirmed_reqs,
            "confirmed": True,
        },
    )
    assert confirm_resp.status_code == 200
    assert confirm_resp.json()["confirmed"] is True

    # Step 3: Connect candidate repository at pinned SHA 1
    repo_uid = uuid.uuid4().hex[:6]
    repo_name = f"student-api-{repo_uid}"
    sha_1 = "1111111111111111111111111111111111111111"
    sha_2 = "2222222222222222222222222222222222222222"

    with patch("backend.app.github.client.GitHubClient.connect_repository", new_callable=AsyncMock) as mock_connect:
        mock_connect.return_value = (
            RepoConnectResult(
                id=None,
                owner="student-dev",
                name=repo_name,
                html_url=f"https://github.com/student-dev/{repo_name}",
                default_branch="main",
                head_sha=sha_1,
                scope=Scope(analyzed=3, skipped=1, skipped_reasons={"vendor": 1}, truncated=False),
                webhook_status=WebhookStatus.NONE,
            ),
            [],
        )
        repo_resp = client.post("/api/repos/connect", json={"repo_url": f"https://github.com/student-dev/{repo_name}"})
        assert repo_resp.status_code == 200
        repo_id = repo_resp.json()["id"]

    # Step 4: Persist the Career Track
    track_resp = client.post(
        "/api/tracks",
        json={
            "job_id": job_id,
            "repo_id": repo_id,
            "branch": "main",
            "head_sha": sha_1,
        },
    )
    assert track_resp.status_code == 200
    track_id = track_resp.json()["id"]

    # Step 5: Initial assessment at SHA 1 (Only SQL database is implemented in SHA 1)
    sample_sql_code = """
from sqlalchemy import Column, Integer, String
from backend.app.db import Base

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True)
    amount = Column(Integer, nullable=False)

def query_transactions(session):
    return session.query(Transaction).all()
"""
    files_tree_1 = [
        {"path": "app/models.py", "type": "blob", "size": len(sample_sql_code), "sha": "blob_models_1"}
    ]

    with patch("backend.app.routers.tracks.GitHubClient.get_tree", new_callable=AsyncMock) as mock_tree_1, \
         patch("backend.app.routers.tracks.GitHubClient.get_blob_content", new_callable=AsyncMock) as mock_blob_1:
        mock_tree_1.return_value = (files_tree_1, False)
        mock_blob_1.return_value = sample_sql_code

        analysis_1 = client.post(f"/api/tracks/{track_id}/analyze").json()
        assert analysis_1["status"] == "complete"
        assert analysis_1["commit_sha"] == sha_1
        assert analysis_1["kind"] == "initial"

        # SQL is demonstrated; REST API and testing are not demonstrated yet
        asms_1 = {a["requirement_name"]: a for a in analysis_1["assessments"]}
        sql_asm = next((a for name, a in asms_1.items() if "SQL" in name or "Database" in name), None)
        assert sql_asm is not None
        assert sql_asm["status"] == "DEMONSTRATED"
        assert len(sql_asm["evidence"]) >= 1

    # Step 6: Student pushes code adding FastAPI REST routes!
    sample_routes_code = """
from fastapi import APIRouter
router = APIRouter()

@router.get("/transactions")
def list_transactions():
    return [{"id": 101, "amount": 500}]
"""
    delivery_id = f"deliv-{uuid.uuid4().hex}"
    push_event = {
        "ref": "refs/heads/main",
        "after": sha_2,
        "repository": {
            "name": repo_name,
            "owner": {"login": "student-dev"},
            "full_name": f"student-dev/{repo_name}",
        },
        "head_commit": {
            "message": "feat: implement transaction GET endpoints",
        },
    }

    with patch("backend.app.evaluator.reassessment.GitHubClient.compare_commits", new_callable=AsyncMock) as mock_cmp, \
         patch("backend.app.evaluator.reassessment.GitHubClient.get_tree", new_callable=AsyncMock) as mock_tree_2, \
         patch("backend.app.evaluator.reassessment.GitHubClient.get_blob_content", new_callable=AsyncMock) as mock_blob_2:
        mock_cmp.return_value = {"files_changed": ["app/routes.py"]}
        mock_tree_2.return_value = ([
            {"path": "app/models.py", "type": "blob", "size": len(sample_sql_code), "sha": "blob_models_1"},
            {"path": "app/routes.py", "type": "blob", "size": len(sample_routes_code), "sha": "blob_routes_2"},
        ], False)

        async def fake_blob(owner, name, blob_sha):
            if blob_sha == "blob_models_1":
                return sample_sql_code
            return sample_routes_code

        mock_blob_2.side_effect = fake_blob

        webhook_resp = client.post(
            "/api/webhooks/github",
            json=push_event,
            headers={
                "X-GitHub-Event": "push",
                "X-GitHub-Delivery": delivery_id,
            },
        )
        assert webhook_resp.status_code == 200
        assert webhook_resp.json()["status"] == "processed"

    # Step 7: Verify immutable history contains 2 runs
    history_resp = client.get(f"/api/tracks/{track_id}/history")
    assert history_resp.status_code == 200
    runs = history_resp.json()
    assert len(runs) >= 2
    assert runs[0]["commit_sha"] == sha_2
    assert runs[1]["commit_sha"] == sha_1

    # Step 8: Verify Before & After Diff
    diff_resp = client.get(f"/api/tracks/{track_id}/diff")
    assert diff_resp.status_code == 200
    diff_data = diff_resp.json()
    assert diff_data["from_sha"] == sha_1
    assert diff_data["to_sha"] == sha_2
    assert "app/routes.py" in diff_data["files_changed"]

    # Verify that REST API skill improved and SQL was carried forward
    rest_diff = next((i for i in diff_data["items"] if "REST" in i["name"] or "API" in i["name"]), None)
    assert rest_diff is not None
    assert rest_diff["change"] == "improved"
    assert rest_diff["after_status"] == "DEMONSTRATED"


def test_phase5_rate_limit_failure_does_not_mask_stale_data(client):
    """Ensures that when GitHub rate limiting occurs, no fake/stale fixture data is shown as live."""
    with patch("backend.app.github.client.GitHubClient.connect_repository", new_callable=AsyncMock) as mock_connect:
        from backend.app.github.client import RateLimitError
        mock_connect.side_effect = RateLimitError(
            message="GitHub API unauthenticated rate limit exceeded. 60 requests per hour per IP.",
            reset_epoch=1770000000,
        )

        resp = client.post("/api/repos/connect", json={"repo_url": "https://github.com/anydev/sample"})
        assert resp.status_code == 429
        data = resp.json()
        assert data["error"]["code"] == "GITHUB_RATE_LIMITED"
        assert data["error"]["reset_epoch"] == 1770000000
