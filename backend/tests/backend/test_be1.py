"""Unit tests for Phase BE-1 (GitHub client, file filter, repo scout, routers).

Tests cover:
- Private or nonexistent repo
- Empty repo
- Truncated tree handling
- Rate limit tracking and pause behavior
- Upstream 5xx retryable error
- Invalid URL parsing
- Secret-like files skipped with 'secret_pattern'
- Repeated connect = one repo row (idempotency)
- Non-Python repo returns scope with analyzed 0 supported files
- Evidence retrieval from cache at stored SHA
"""

from __future__ import annotations

import httpx
import pytest
import respx
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.agents.repo_scout import RepoScout
from backend.app.db import get_db, init_db
from backend.app.github.client import GitHubAPIError, GitHubClient
from backend.app.github.files import filter_repo_tree, is_secret_like
from backend.app.main import app
from backend.app.models import EvidenceModel, FileCacheModel, JobModel, RepoModel


@pytest.fixture
def test_db():
    """In-memory SQLite database for isolated test execution with StaticPool."""
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    init_db(engine_override=test_engine)
    testing_session_local = sessionmaker(
        autocommit=False, autoflush=False, bind=test_engine
    )
    db = testing_session_local()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client(test_db: Session):
    """FastAPI TestClient with overridden get_db dependency."""

    def override_get_db():
        try:
            yield test_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# --- 1. GitHubClient & Error Mapping Tests ---


@pytest.mark.asyncio
@respx.mock
async def test_github_client_nonexistent_repo():
    """Verify 404 response maps to REPO_NOT_FOUND without retry."""
    respx.get("https://api.github.com/repos/test-owner/missing-repo").mock(
        return_value=httpx.Response(404, json={"message": "Not Found"})
    )
    client = GitHubClient(token="mock-token")
    with pytest.raises(GitHubAPIError) as exc_info:
        await client.get_repo("test-owner", "missing-repo")
    assert exc_info.value.code == "REPO_NOT_FOUND"
    assert exc_info.value.status_code == 404
    assert not exc_info.value.retryable
    await client.close()


@pytest.mark.asyncio
@respx.mock
async def test_github_client_private_repo():
    """Verify 403 response without rate limit headers maps to REPO_PRIVATE."""
    respx.get("https://api.github.com/repos/test-owner/private-repo").mock(
        return_value=httpx.Response(
            403,
            json={"message": "Must have admin rights"},
            headers={"x-ratelimit-remaining": "50"},
        )
    )
    client = GitHubClient(token="mock-token")
    with pytest.raises(GitHubAPIError) as exc_info:
        await client.get_repo("test-owner", "private-repo")
    assert exc_info.value.code == "REPO_PRIVATE"
    assert exc_info.value.status_code == 403
    assert not exc_info.value.retryable
    await client.close()


@pytest.mark.asyncio
@respx.mock
async def test_github_client_rate_limit_pause():
    """Verify rate limit tracking updates remaining and pauses polling below 10."""
    respx.get("https://api.github.com/repos/test-owner/repo").mock(
        return_value=httpx.Response(
            403,
            json={"message": "API rate limit exceeded"},
            headers={"x-ratelimit-remaining": "0"},
        )
    )
    client = GitHubClient(token="mock-token")
    with pytest.raises(GitHubAPIError) as exc_info:
        await client.get_repo("test-owner", "repo")
    assert exc_info.value.code == "RATE_LIMITED"
    assert exc_info.value.retryable
    assert client.rate_remaining == 0
    assert client.should_pause_polling() is True
    await client.close()


@pytest.mark.asyncio
@respx.mock
async def test_github_client_upstream_5xx():
    """Verify 5xx upstream server error maps to retryable GITHUB_UPSTREAM_ERROR."""
    respx.get("https://api.github.com/repos/test-owner/error-repo").mock(
        return_value=httpx.Response(502, text="Bad Gateway")
    )
    client = GitHubClient(token="mock-token")
    with pytest.raises(GitHubAPIError) as exc_info:
        await client.get_repo("test-owner", "error-repo")
    assert exc_info.value.code == "GITHUB_UPSTREAM_ERROR"
    assert exc_info.value.retryable
    await client.close()


# --- 2. File Filter & Secret Protection Tests ---


def test_is_secret_like():
    """Verify secret file pattern detection."""
    assert is_secret_like(".env") is True
    assert is_secret_like(".env.production") is True
    assert is_secret_like("secrets/credentials.json") is True
    assert is_secret_like("id_rsa") is True
    assert is_secret_like("cert.pem") is True
    assert is_secret_like("server.key") is True
    # .env.example must NEVER be considered a secret
    assert is_secret_like(".env.example") is False
    assert is_secret_like("main.py") is False


def test_filter_repo_tree_secret_and_binary_skipped():
    """Verify secrets and binaries are never analyzed and recorded in skipped_reasons."""
    tree = [
        {"type": "blob", "path": "main.py", "size": 500, "sha": "sha_main"},
        {"type": "blob", "path": ".env", "size": 100, "sha": "sha_env"},
        {"type": "blob", "path": "logo.png", "size": 2048, "sha": "sha_logo"},
        {"type": "blob", "path": "package-lock.json", "size": 4000, "sha": "sha_lock"},
        {
            "type": "blob",
            "path": "node_modules/dep/index.js",
            "size": 300,
            "sha": "sha_node",
        },
    ]
    analyzed, scope = filter_repo_tree(tree, max_files=150, max_bytes=100000)
    assert len(analyzed) == 1
    assert analyzed[0]["path"] == "main.py"
    assert scope.analyzed == 1
    assert scope.skipped == 4
    assert scope.skipped_reasons["secret_pattern"] == 1
    assert scope.skipped_reasons["binary"] == 1
    assert scope.skipped_reasons["lockfile"] == 1
    assert scope.skipped_reasons["ignored_directory"] == 1
    assert not scope.truncated


def test_filter_repo_tree_truncated_handling():
    """Verify scope report captures truncated flag and budget cap."""
    # 5 files when budget is 3
    tree = [
        {"type": "blob", "path": f"module_{i}.py", "size": 100, "sha": f"sha_{i}"}
        for i in range(5)
    ]
    analyzed, scope = filter_repo_tree(tree, max_files=3, max_bytes=100000)
    assert len(analyzed) == 3
    assert scope.analyzed == 3
    assert scope.skipped == 2
    assert scope.skipped_reasons["max_files_exceeded"] == 2
    assert scope.truncated is True


def test_filter_non_python_repo():
    """Verify non-Python repository results in 0 supported files analyzed."""
    tree = [
        {"type": "blob", "path": "index.html", "size": 500, "sha": "sha1"},
        {"type": "blob", "path": "style.css", "size": 400, "sha": "sha2"},
        {"type": "blob", "path": "app.js", "size": 800, "sha": "sha3"},
    ]
    analyzed, scope = filter_repo_tree(tree)
    assert len(analyzed) == 0
    assert scope.analyzed == 0
    assert scope.skipped == 3
    assert scope.skipped_reasons.get("unsupported_extension") == 3


# --- 3. Repo Scout URL Parsing & Empty Repo Tests ---


def test_repo_scout_parse_urls():
    """Verify RepoScout handles various valid GitHub URL formats."""
    owner, name, branch = RepoScout.parse_repo_url(
        "https://github.com/rohan/student-api"
    )
    assert (owner, name, branch) == ("rohan", "student-api", None)

    owner, name, branch = RepoScout.parse_repo_url(
        "https://github.com/rohan/student-api.git"
    )
    assert (owner, name, branch) == ("rohan", "student-api", None)

    owner, name, branch = RepoScout.parse_repo_url(
        "https://github.com/rohan/student-api/tree/feature-branch"
    )
    assert (owner, name, branch) == ("rohan", "student-api", "feature-branch")

    owner, name, branch = RepoScout.parse_repo_url("rohan/student-api")
    assert (owner, name, branch) == ("rohan", "student-api", None)

    with pytest.raises(GitHubAPIError) as exc_info:
        RepoScout.parse_repo_url("invalid-url-string")
    assert exc_info.value.code == "REPO_INVALID"


# --- 4. API Endpoints Integration Tests (TestClient) ---


@respx.mock
def test_repos_connect_repeated_is_one_row(client: TestClient, test_db: Session):
    """Verify repeated connect calls for the same repo maintain exactly one database row."""
    respx.get("https://api.github.com/repos/rohan/student-api").mock(
        return_value=httpx.Response(
            200,
            json={
                "id": 1234,
                "name": "student-api",
                "default_branch": "main",
                "html_url": "https://github.com/rohan/student-api",
            },
        )
    )
    respx.get("https://api.github.com/repos/rohan/student-api/commits/main").mock(
        return_value=httpx.Response(
            200,
            json={
                "sha": "c0_sha_123456789012345678901234567890123456",
                "commit": {
                    "message": "feat: initial commit",
                    "author": {"name": "Rohan", "date": "2026-10-17T00:00:00Z"},
                },
            },
        )
    )
    respx.get(
        "https://api.github.com/repos/rohan/student-api/git/trees/c0_sha_123456789012345678901234567890123456?recursive=1"
    ).mock(
        return_value=httpx.Response(
            200,
            json={
                "truncated": False,
                "tree": [
                    {
                        "type": "blob",
                        "path": "app/main.py",
                        "size": 500,
                        "sha": "blob_main_1",
                    }
                ],
            },
        )
    )
    respx.get(
        "https://api.github.com/repos/rohan/student-api/git/blobs/blob_main_1"
    ).mock(
        return_value=httpx.Response(
            200,
            json={
                "encoding": "base64",
                "content": "ZnJvbSBmYXN0YXBpIGltcG9ydCBGYXN0QVBJ",  # "from fastapi import FastAPI"
            },
        )
    )

    # First connect call
    resp1 = client.post(
        "/api/repos/connect",
        json={"repo_url": "https://github.com/rohan/student-api"},
    )
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1["owner"] == "rohan"
    assert data1["name"] == "student-api"
    assert data1["head_sha"].startswith("c0_sha")
    assert data1["scope"]["analyzed"] == 1

    # Second connect call for the same repo
    resp2 = client.post(
        "/api/repos/connect",
        json={"repo_url": "https://github.com/rohan/student-api"},
    )
    assert resp2.status_code == 200

    # Ensure only 1 row exists in DB
    rows = test_db.query(RepoModel).all()
    assert len(rows) == 1
    assert rows[0].id == "rohan/student-api"


@respx.mock
def test_github_users_repos_endpoint(client: TestClient):
    """Verify GET /api/github/users/{u}/repos returns candidate repos prioritized."""
    respx.get("https://api.github.com/users/rohan/repos").mock(
        return_value=httpx.Response(
            200,
            json=[
                {
                    "id": 1,
                    "name": "forked-repo",
                    "fork": True,
                    "private": False,
                    "html_url": "https://github.com/rohan/forked-repo",
                },
                {
                    "id": 2,
                    "name": "student-api",
                    "fork": False,
                    "private": False,
                    "html_url": "https://github.com/rohan/student-api",
                },
                {
                    "id": 3,
                    "name": "secret-repo",
                    "fork": False,
                    "private": True,
                    "html_url": "https://github.com/rohan/secret-repo",
                },
            ],
        )
    )
    resp = client.get("/api/github/users/rohan/repos")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2  # private repo filtered out
    # Non-fork prioritized first
    assert data[0]["name"] == "student-api"
    assert data[1]["name"] == "forked-repo"


def test_evidence_file_retrieval(client: TestClient, test_db: Session):
    """Verify GET /api/evidence/{id}/file reads cached content at analyzed SHA."""
    # Seed file cache
    cache = FileCacheModel(
        blob_sha="blob_c2_db",
        path="app/db.py",
        content="def get_connection(): return sqlite3.connect('test.db')",
    )
    test_db.add(cache)

    evidence = EvidenceModel(
        id="evi_sql_001",
        assessment_id="ass_001",
        signal_id="sig_001",
        detector="sql_database",
        file_path="app/db.py",
        line_start=1,
        line_end=1,
        snippet="def get_connection()",
        blob_sha="blob_c2_db",
        strength="strong",
        counted=True,
    )
    test_db.add(evidence)
    test_db.commit()

    resp = client.get("/api/evidence/evi_sql_001/file")
    assert resp.status_code == 200
    data = resp.json()
    assert data["path"] == "app/db.py"
    assert data["sha"] == "blob_c2_db"
    assert "sqlite3.connect" in data["content"]
    assert data["line_start"] == 1


def test_track_creation_and_listing(client: TestClient, test_db: Session):
    """Verify POST /api/tracks and GET /api/tracks."""
    # Seed a JobModel
    job = JobModel(
        id="job_demo_1",
        title="Backend Intern",
        company="TechCorp",
        source_url="https://example.com/job",
        source_type="fetched",
    )
    test_db.add(job)

    # Seed a RepoModel
    repo = RepoModel(
        id="rohan/student-api",
        owner="rohan",
        name="student-api",
        default_branch="main",
        html_url="https://github.com/rohan/student-api",
    )
    test_db.add(repo)
    test_db.commit()

    # Create track
    resp = client.post(
        "/api/tracks",
        json={
            "job_id": "job_demo_1",
            "repo_url": "https://github.com/rohan/student-api",
            "branch": "main",
        },
    )
    assert resp.status_code == 200
    track_data = resp.json()
    track_id = track_data["id"]
    assert track_data["job_id"] == "job_demo_1"
    assert track_data["repo_id"] == "rohan/student-api"

    # List tracks
    list_resp = client.get("/api/tracks")
    assert list_resp.status_code == 200
    tracks = list_resp.json()
    assert len(tracks) >= 1
    assert any(t["id"] == track_id for t in tracks)

    # Get track by id
    get_resp = client.get(f"/api/tracks/{track_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == track_id
