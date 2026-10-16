"""Tests for Phase 3: Deterministic Detectors, Skeptic Verifier, and Assessment Engine."""
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.detectors.rest_api import detect_rest_api
from backend.app.detectors.sql_database import detect_sql_database
from backend.app.detectors.testing import detect_testing
from backend.app.detectors.auth import detect_auth
from backend.app.detectors.async_concurrency import detect_async_concurrency
from backend.app.detectors.deployment import detect_deployment
from backend.app.detectors.base import DetectedSignal
from backend.app.schemas import AssessmentStatus, Priority, RequirementDraft, SignalStrength
from backend.app.verifier.skeptic import SkepticVerifier
from backend.app.evaluator.engine import AssessmentEngine


@pytest.fixture
def client():
    return TestClient(app)


# -----------------------------------------------------------------------------
# Detector Unit Tests
# -----------------------------------------------------------------------------

def test_detect_rest_api_positive_and_weak_gate():
    # Strong endpoint
    content_strong = """
from fastapi import APIRouter

router = APIRouter()

@router.get("/users")
def get_users():
    return [{"id": 1, "name": "Alice"}]
"""
    signals = detect_rest_api("app/routers/users.py", content_strong, "sha123")
    assert len(signals) == 1
    assert signals[0].strength == SignalStrength.STRONG
    assert signals[0].counted is True

    # Weak empty endpoint (pass / stub)
    content_weak = """
@app.post("/items")
def create_item():
    pass
"""
    weak_signals = detect_rest_api("app/routes.py", content_weak, "sha123")
    assert len(weak_signals) == 1
    assert weak_signals[0].strength == SignalStrength.WEAK
    assert weak_signals[0].counted is False


def test_detect_sql_database():
    content = """
from sqlalchemy import Column, Integer, String
from backend.app.db import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(50))

def fetch_user(db, user_id):
    return db.query(User).filter_by(id=user_id).first()
"""
    signals = detect_sql_database("app/models.py", content, "sha123")
    assert len(signals) >= 2
    types = [s.why for s in signals]
    assert any("ORM model" in t for t in types)
    assert any("Database execution" in t for t in types)


def test_detect_testing_with_assertion_gate():
    content = """
import pytest

def test_addition():
    assert 2 + 2 == 4

def test_trivial():
    assert True
"""
    signals = detect_testing("tests/test_math.py", content, "sha123")
    assert len(signals) == 2
    # First is counted
    assert signals[0].strength == SignalStrength.STRONG
    assert signals[0].counted is True
    # Second is trivial assert True -> uncounted weak signal
    assert signals[1].strength == SignalStrength.WEAK
    assert signals[1].counted is False


def test_detect_auth():
    content = """
import jwt
from passlib.context import CryptContext

def create_access_token(data: dict):
    return jwt.encode(data, "secret", algorithm="HS256")
"""
    signals = detect_auth("app/auth.py", content, "sha123")
    assert len(signals) >= 2
    assert any(s.strength == SignalStrength.STRONG for s in signals)


def test_detect_async_concurrency():
    content = """
import asyncio

async def fetch_data():
    await asyncio.sleep(1)
    return "done"
"""
    signals = detect_async_concurrency("app/service.py", content, "sha123")
    assert len(signals) >= 1
    assert signals[0].strength == SignalStrength.STRONG


def test_detect_deployment_and_capping():
    content = """
FROM python:3.11-slim
WORKDIR /app
COPY . .
CMD ["uvicorn", "main:app"]
"""
    signals = detect_deployment("Dockerfile", content, "sha123")
    assert len(signals) == 1
    assert signals[0].category_key == "deployment"
    assert "capped at PARTIAL" in signals[0].limitation


# -----------------------------------------------------------------------------
# Skeptic Verifier Unit Tests
# -----------------------------------------------------------------------------

def test_skeptic_verifier_matches_content():
    content = "line 1\nline 2: target\nline 3\n"
    signal = DetectedSignal(
        signal_id="sig1",
        detector="rest_api",
        category_key="rest_api",
        file_path="main.py",
        line_start=2,
        line_end=2,
        snippet="line 2: target",
        blob_sha="blob1",
        strength=SignalStrength.STRONG,
        counted=True,
        why="test",
    )
    is_valid, reason, ev = SkepticVerifier.verify_citation(signal, content)
    assert is_valid is True
    assert reason is None
    assert ev.snippet == "line 2: target"


def test_skeptic_verifier_rejects_bounds_or_mismatch():
    content = "line 1\nline 2\n"
    # Out of bounds
    signal_out = DetectedSignal(
        signal_id="sig1",
        detector="rest_api",
        category_key="rest_api",
        file_path="main.py",
        line_start=5,
        line_end=10,
        snippet="ghost lines",
        blob_sha="blob1",
        strength=SignalStrength.STRONG,
        counted=True,
        why="test",
    )
    is_valid, reason, _ = SkepticVerifier.verify_citation(signal_out, content)
    assert is_valid is False
    assert "bounds" in reason.lower()

    # Content mismatch
    signal_mismatch = DetectedSignal(
        signal_id="sig2",
        detector="rest_api",
        category_key="rest_api",
        file_path="main.py",
        line_start=1,
        line_end=1,
        snippet="different content altogether",
        blob_sha="blob1",
        strength=SignalStrength.STRONG,
        counted=True,
        why="test",
    )
    is_valid, reason, _ = SkepticVerifier.verify_citation(signal_mismatch, content)
    assert is_valid is False
    assert "mismatch" in reason.lower()


# -----------------------------------------------------------------------------
# Assessment Engine Rules & Invariants
# -----------------------------------------------------------------------------

def test_assessment_engine_no_evidence_gives_not_demonstrated():
    req = RequirementDraft(
        id=1,
        name="REST API Development",
        category="Backend",
        priority=Priority.MUST,
        source_sentence="Must build APIs.",
        taxonomy_key="rest_api",
        search_terms=["router"],
    )
    asm = AssessmentEngine.evaluate_requirement(req, [])
    assert asm.status == AssessmentStatus.NOT_DEMONSTRATED
    assert "No matching evidence" in asm.summary
    assert "does not mean candidate lacks the skill" in asm.limitation


def test_assessment_engine_testing_and_deployment_capped_at_partial():
    req_test = RequirementDraft(
        id=2,
        name="Automated Testing",
        category="QA",
        priority=Priority.MUST,
        source_sentence="Must write tests.",
        taxonomy_key="testing",
        search_terms=["pytest"],
    )
    from backend.app.schemas import EvidenceItem
    ev = EvidenceItem(
        signal_id="sig1",
        detector="testing",
        file_path="tests/test_api.py",
        line_start=1,
        line_end=3,
        snippet="assert True",
        blob_sha="blob1",
        strength=SignalStrength.STRONG,
        counted=True,
    )
    asm = AssessmentEngine.evaluate_requirement(req_test, [ev])
    assert asm.status == AssessmentStatus.PARTIAL
    assert "Capped at PARTIAL" in asm.summary


# -----------------------------------------------------------------------------
# End-to-End POST /api/tracks/{id}/analyze Test
# -----------------------------------------------------------------------------

def test_analyze_track_endpoint_and_idempotency(client):
    # 1. Setup a job draft
    extract_resp = client.post("/api/jobs/extract", json={"text": "TechCorp is hiring a Python Developer. Build REST APIs with FastAPI, write SQL queries, and Pytest tests."})
    job_id = extract_resp.json()["id"]
    client.put(f"/api/jobs/{job_id}/confirm", json={
        "title": "Python Developer",
        "company": "TechCorp",
        "requirements": extract_resp.json()["requirements"],
        "confirmed": True,
    })

    # 2. Connect repository (mocked)
    with patch("backend.app.github.client.GitHubClient.connect_repository", new_callable=AsyncMock) as mock_connect:
        from backend.app.schemas import RepoConnectResult, Scope, WebhookStatus
        mock_connect.return_value = (
            RepoConnectResult(
                id=None,
                owner="sampledev",
                name="career-api",
                html_url="https://github.com/sampledev/career-api",
                default_branch="main",
                head_sha="deadbeef00000000000000000000000000000001",
                scope=Scope(analyzed=2, skipped=0, skipped_reasons={}, truncated=False),
                webhook_status=WebhookStatus.NONE,
            ),
            []
        )
        repo_resp = client.post("/api/repos/connect", json={"repo_url": "https://github.com/sampledev/career-api"})
        repo_id = repo_resp.json()["id"]

    # 3. Create persistent track
    track_resp = client.post("/api/tracks", json={
        "job_id": job_id,
        "repo_id": repo_id,
        "branch": "main",
        "head_sha": "deadbeef00000000000000000000000000000001",
    })
    track_id = track_resp.json()["id"]

    # 4. Trigger Analysis (Mocking GitHubClient tree and blob methods)
    sample_py = """
from fastapi import APIRouter
router = APIRouter()

@router.get("/items")
def get_items():
    return [{"name": "item1"}]
"""
    with patch("backend.app.routers.tracks.GitHubClient.get_tree", new_callable=AsyncMock) as mock_tree, \
         patch("backend.app.routers.tracks.GitHubClient.get_blob_content", new_callable=AsyncMock) as mock_blob:
        mock_tree.return_value = ([
            {"path": "app/routes.py", "type": "blob", "size": len(sample_py), "sha": "blob123"}
        ], False)
        mock_blob.return_value = sample_py

        analyze_resp = client.post(f"/api/tracks/{track_id}/analyze")
        assert analyze_resp.status_code == 200, analyze_resp.text
        data = analyze_resp.json()
        assert data["status"] == "complete"
        assert data["commit_sha"] == "deadbeef00000000000000000000000000000001"
        assert len(data["assessments"]) >= 1

        # Check REST API requirement got DEMONSTRATED with verified citation
        rest_asm = next((a for a in data["assessments"] if a["requirement_name"] == "REST API Development"), None)
        assert rest_asm is not None
        assert rest_asm["status"] == "DEMONSTRATED"
        assert len(rest_asm["evidence"]) >= 1
        assert rest_asm["evidence"][0]["file_path"] == "app/routes.py"
        assert rest_asm["evidence"][0]["line_start"] == 6

        # 5. Idempotent check: Calling analyze again returns existing analysis
        repeat_resp = client.post(f"/api/tracks/{track_id}/analyze")
        assert repeat_resp.status_code == 200
        assert repeat_resp.json()["id"] == data["id"]

        # 6. History check
        hist_resp = client.get(f"/api/tracks/{track_id}/history")
        assert hist_resp.status_code == 200
        assert len(hist_resp.json()) >= 1
