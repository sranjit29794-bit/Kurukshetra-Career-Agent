import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.jobs.extractor import extract_requirements_deterministic, _extract_title_and_company
from backend.app.jobs.fetcher import is_safe_url, clean_html_to_text, JobFetchError
from backend.app.schemas import Priority


@pytest.fixture
def client():
    return TestClient(app)


# -------------------------------------------------------------------------
# Security & URL Safety Tests (SSRF Prevention)
# -------------------------------------------------------------------------

def test_is_safe_url_blocks_localhost():
    safe, reason = is_safe_url("http://localhost:8000/job")
    assert not safe
    assert "localhost" in reason.lower()

    safe, reason = is_safe_url("http://127.0.0.1:5000/job")
    assert not safe
    assert "loopback" in reason.lower() or "localhost" in reason.lower()


def test_is_safe_url_blocks_non_http():
    safe, reason = is_safe_url("file:///etc/passwd")
    assert not safe
    assert "only http and https" in reason.lower()

    safe, reason = is_safe_url("ftp://example.com/job")
    assert not safe


def test_is_safe_url_allows_public_https():
    safe, reason = is_safe_url("https://careers.google.com/jobs/results/12345")
    assert safe
    assert reason is None


def test_clean_html_strips_scripts_and_styles():
    html_input = """
    <html>
      <head><title>Job Page</title></head>
      <body>
        <script>alert('malicious');</script>
        <style>body { color: red; }</style>
        <h1>NovaPay Senior Engineer</h1>
        <p>We are seeking a <b>Backend Engineer</b> with Python and FastAPI experience.</p>
        <p>Must know SQL databases and write pytest unit tests.</p>
      </body>
    </html>
    """
    cleaned = clean_html_to_text(html_input)
    assert "alert" not in cleaned
    assert "color: red" not in cleaned
    assert "NovaPay Senior Engineer" in cleaned
    assert "FastAPI experience" in cleaned


# -------------------------------------------------------------------------
# Deterministic Extractor Unit Tests
# -------------------------------------------------------------------------

def test_deterministic_extraction():
    job_text = (
        "Acme Cloud is hiring a Python Backend Engineer. "
        "Design and maintain high-throughput REST APIs using FastAPI and Flask. "
        "Optimize complex SQL queries on PostgreSQL database tables. "
        "Write thorough unit tests using pytest. "
        "Experience containerizing services with Docker is a plus."
    )
    title, company = _extract_title_and_company(job_text)
    assert "Backend Engineer" in title or "Python" in title
    assert "Acme Cloud" in company

    reqs = extract_requirements_deterministic(job_text)
    keys = [r.taxonomy_key for r in reqs]
    assert "rest_api" in keys
    assert "sql_database" in keys
    assert "testing" in keys
    assert "deployment" in keys

    # Verify each requirement has genuine source sentences
    for r in reqs:
        assert len(r.source_sentence) > 10
        assert r.name
        assert r.category


# -------------------------------------------------------------------------
# /api/jobs and /api/tracks End-to-End API Tests
# -------------------------------------------------------------------------

def test_extract_pasted_job_text_and_confirm(client):
    job_text = (
        "Datadrive Systems is seeking a Backend Developer. "
        "Responsibilities: Implement secure REST APIs with token authentication. "
        "Maintain SQLite databases and write robust unit tests with pytest."
    )

    # 1. Post extraction request with text
    resp = client.post("/api/jobs/extract", json={"text": job_text})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["id"] is not None
    assert data["source_type"] == "user_provided"
    assert data["confirmed"] is False
    assert len(data["requirements"]) >= 2
    job_id = data["id"]

    # 2. Get unconfirmed job
    get_resp = client.get(f"/api/jobs/{job_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == job_id

    # 3. Confirm requirements with custom edits
    updated_reqs = [
        {
            "name": "Custom REST API Development",
            "category": "Backend Engineering",
            "priority": "must",
            "source_sentence": "Implement secure REST APIs with token authentication.",
            "taxonomy_key": "rest_api",
            "search_terms": ["fastapi", "router", "endpoint"],
        },
        {
            "name": "Database Schema & SQL",
            "category": "Data & Storage",
            "priority": "must",
            "source_sentence": "Maintain SQLite databases.",
            "taxonomy_key": "sql_database",
            "search_terms": ["sql", "sqlite"],
        },
    ]

    confirm_resp = client.put(
        f"/api/jobs/{job_id}/confirm",
        json={
            "title": "Backend Developer",
            "company": "Datadrive Systems",
            "requirements": updated_reqs,
            "confirmed": True,
        },
    )
    assert confirm_resp.status_code == 200
    confirmed_data = confirm_resp.json()
    assert confirmed_data["confirmed"] is True
    assert len(confirmed_data["requirements"]) == 2
    assert confirmed_data["requirements"][0]["name"] == "Custom REST API Development"


def test_extract_job_url_unsafe_rejection(client):
    # SSRF destination should fail safely with structured error
    resp = client.post("/api/jobs/extract", json={"url": "http://127.0.0.1:8000/internal-job"})
    assert resp.status_code == 400
    data = resp.json()
    assert "error" in data
    assert data["error"]["code"] == "UNSAFE_URL"


def test_extract_job_url_mocked_success(client):
    with patch("backend.app.routers.jobs.fetch_job_page", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = "Apex Corp is seeking a Software Engineer Intern\nBuild scalable REST APIs in Python. Optimize relational SQL databases. Write automated unit tests with pytest."
        resp = client.post("/api/jobs/extract", json={"url": "https://example.com/jobs/intern"})
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["source_type"] == "fetched"
        assert data["source_url"] == "https://example.com/jobs/intern"
        assert len(data["requirements"]) >= 3


def test_track_creation_and_retrieval_flow(client):
    # 1. Create a confirmed job
    extract_resp = client.post(
        "/api/jobs/extract",
        json={"text": "TechCorp is hiring a Python Engineer. Build REST APIs and use SQL databases."}
    )
    job_id = extract_resp.json()["id"]

    # Confirm job
    client.put(
        f"/api/jobs/{job_id}/confirm",
        json={
            "title": "Python Engineer",
            "company": "TechCorp",
            "requirements": extract_resp.json()["requirements"],
            "confirmed": True,
        }
    )

    # 2. Connect a repository (mocking the GitHub tree call for reliability)
    with patch("backend.app.github.client.GitHubClient.connect_repository", new_callable=AsyncMock) as mock_connect:
        from backend.app.schemas import RepoConnectResult, Scope, WebhookStatus
        mock_connect.return_value = (
            RepoConnectResult(
                id=None,
                owner="sampledev",
                name="career-api",
                html_url="https://github.com/sampledev/career-api",
                default_branch="main",
                head_sha="a1b2c3d4e5f6789012345678901234567890abcd",
                scope=Scope(analyzed=10, skipped=2, skipped_reasons={}, truncated=False),
                webhook_status=WebhookStatus.NONE,
            ),
            []
        )
        repo_resp = client.post("/api/repos/connect", json={"repo_url": "https://github.com/sampledev/career-api"})
        assert repo_resp.status_code == 200
        repo_id = repo_resp.json()["id"]
        assert repo_id is not None

    # 3. Create persistent track linking Job and Repo
    track_resp = client.post(
        "/api/tracks",
        json={
            "job_id": job_id,
            "repo_id": repo_id,
            "branch": "main",
            "head_sha": "a1b2c3d4e5f6789012345678901234567890abcd",
        }
    )
    assert track_resp.status_code == 200
    track_data = track_resp.json()
    assert track_data["id"] is not None
    assert track_data["job_id"] == job_id
    assert track_data["repo_id"] == repo_id
    assert track_data["last_seen_sha"] == "a1b2c3d4e5f6789012345678901234567890abcd"
    assert track_data["job"]["confirmed"] is True
    assert track_data["repo"]["owner"] == "sampledev"

    track_id = track_data["id"]

    # 4. Retrieve single track
    get_track_resp = client.get(f"/api/tracks/{track_id}")
    assert get_track_resp.status_code == 200
    assert get_track_resp.json()["id"] == track_id

    # 5. List tracks
    list_resp = client.get("/api/tracks")
    assert list_resp.status_code == 200
    assert any(t["id"] == track_id for t in list_resp.json())
