import asyncio
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
import httpx

from backend.app.main import app
from backend.app.jobs.extractor import (
    extract_requirements_deterministic,
    _extract_title_and_company,
    analyze_job_text,
)
from backend.app.jobs.fetcher import (
    is_safe_url,
    clean_html_to_text,
    fetch_job_page,
    JobFetchError,
)
from backend.app.schemas import Priority, SourceType


@pytest.fixture
def client():
    return TestClient(app)


# ==============================================================================
# 1. SSRF & URL Validation Tests
# ==============================================================================

def test_is_safe_url_rejects_credentials_in_url():
    """URLs with userinfo (user:pass@host) must be rejected to prevent credential leakage."""
    safe, reason = is_safe_url("http://admin:secret123@example.com/job")
    assert not safe
    assert "embedded credentials" in reason.lower()

    safe2, reason2 = is_safe_url("https://candidate@example.com/posting")
    assert not safe2
    assert "embedded credentials" in reason2.lower()


def test_is_safe_url_rejects_loopback_and_private_ips():
    """Validates rejection of 127.0.0.1, localhost, and private ranges."""
    for bad_url in [
        "http://localhost:8000/job",
        "http://127.0.0.1:9000/api",
        "http://10.0.0.1/job",
        "http://192.168.1.1/admin",
        "http://169.254.169.254/latest/meta-data/",
    ]:
        safe, reason = is_safe_url(bad_url)
        assert not safe, f"Expected {bad_url} to be rejected"
        assert reason is not None


def test_is_safe_url_rejects_unsupported_schemes():
    """Only HTTP and HTTPS schemes should be accepted."""
    for bad_url in [
        "file:///etc/passwd",
        "ftp://ftp.example.com/job.txt",
        "gopher://example.com/",
        "data:text/html,<h1>Job</h1>",
        "javascript:alert(1)",
    ]:
        safe, reason = is_safe_url(bad_url)
        assert not safe
        assert "only http and https" in reason.lower() or "malformed" in reason.lower()


# ==============================================================================
# 2. HTML Cleaning & Boilerplate Removal Tests
# ==============================================================================

def test_clean_html_removes_nav_footer_scripts():
    raw_html = """
    <html>
      <head><title>Careers Portal</title></head>
      <body>
        <nav><a href="/home">Home</a><a href="/login">Sign In</a></nav>
        <header><h1>Acme Software</h1></header>
        <main>
          <h2>Backend Engineer Intern</h2>
          <p>We are looking for an engineer proficient in Python and FastAPI REST APIs.</p>
          <p>Experience with PostgreSQL databases and Docker containers is preferred.</p>
        </main>
        <footer><p>&copy; 2026 Acme Corp. All rights reserved. Privacy Policy.</p></footer>
        <script>console.log("tracking");</script>
      </body>
    </html>
    """
    cleaned = clean_html_to_text(raw_html)
    assert "Sign In" not in cleaned  # nav stripped
    assert "tracking" not in cleaned  # script stripped
    assert "Backend Engineer Intern" in cleaned
    assert "FastAPI REST APIs" in cleaned
    assert "PostgreSQL databases" in cleaned


# ==============================================================================
# 3. URL Fetch Security: Timeouts, Oversized, Non-HTML, and Anti-Bot Handling
# ==============================================================================

@pytest.mark.asyncio
async def test_fetch_job_page_oversized_response():
    """Simulates a response exceeding max_bytes."""
    mock_resp = MagicMock()
    mock_resp.is_redirect = False
    mock_resp.status_code = 200
    mock_resp.headers = {"content-type": "text/html"}
    mock_resp.content = b"A" * 3_000_000  # 3MB > 2MB limit

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        with pytest.raises(JobFetchError) as exc_info:
            await fetch_job_page("https://example.com/giant-job", max_bytes=2_000_000)
        assert exc_info.value.code == "RESPONSE_TOO_LARGE"


@pytest.mark.asyncio
async def test_fetch_job_page_non_html_rejection():
    """Simulates binary or unsupported content type."""
    mock_resp = MagicMock()
    mock_resp.is_redirect = False
    mock_resp.status_code = 200
    mock_resp.headers = {"content-type": "application/pdf"}
    mock_resp.content = b"%PDF-1.4..."

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        with pytest.raises(JobFetchError) as exc_info:
            await fetch_job_page("https://example.com/job.pdf")
        assert exc_info.value.code == "INVALID_CONTENT_TYPE"


@pytest.mark.asyncio
async def test_fetch_job_page_anti_bot_403():
    """Simulates anti-bot or access restricted 403."""
    mock_resp = MagicMock()
    mock_resp.is_redirect = False
    mock_resp.status_code = 403
    mock_resp.headers = {"content-type": "text/html"}

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        with pytest.raises(JobFetchError) as exc_info:
            await fetch_job_page("https://www.linkedin.com/jobs/view/123456")
        assert exc_info.value.code == "ANTI_BOT_BLOCKED"
        assert "pasted job description" in exc_info.value.message.lower()


@pytest.mark.asyncio
async def test_fetch_job_page_insufficient_content():
    """Simulates empty or JavaScript-only page (<50 chars)."""
    mock_resp = MagicMock()
    mock_resp.is_redirect = False
    mock_resp.status_code = 200
    mock_resp.headers = {"content-type": "text/html"}
    mock_resp.content = b"<html><body><noscript>Enable JS</noscript></body></html>"
    mock_resp.encoding = "utf-8"

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        with pytest.raises(JobFetchError) as exc_info:
            await fetch_job_page("https://example.com/empty-job")
        assert exc_info.value.code == "EMPTY_JOB_CONTENT"


# ==============================================================================
# 4. Contextual Requirement Extraction & Deduplication
# ==============================================================================

def test_extract_requirements_dynamic_priority():
    """Verifies that 'nice to have' / 'plus' marks priority as NICE, while 'must' / 'required' marks MUST."""
    job_text = (
        "Role: Senior Platform Engineer\n"
        "Company: CloudScale Systems\n"
        "Requirements:\n"
        "- Must have strong experience designing REST API endpoints.\n"
        "- Required: proficiency in SQL database schema design and optimization.\n"
        "- Automated testing with pytest is mandatory.\n"
        "- Docker and container deployment experience is a nice to have bonus.\n"
        "- Familiarity with AWS or GCP cloud platforms is an optional plus.\n"
    )
    reqs = extract_requirements_deterministic(job_text)
    req_map = {r.taxonomy_key: r for r in reqs}

    assert "rest_api" in req_map
    assert req_map["rest_api"].priority == Priority.MUST

    assert "sql_database" in req_map
    assert req_map["sql_database"].priority == Priority.MUST

    assert "testing" in req_map
    assert req_map["testing"].priority == Priority.MUST

    assert "deployment" in req_map
    assert req_map["deployment"].priority == Priority.NICE

    assert "cloud_aws_gcp" in req_map
    assert req_map["cloud_aws_gcp"].priority == Priority.NICE


def test_manual_target_role_override():
    """Verifies that manual target_role takes precedence over heuristic title extraction."""
    job_text = "Acme Corp is hiring an Associate Software Tester. Testing with pytest is required."
    title, company = _extract_title_and_company(job_text)
    assert "Tester" in title or "Software" in title

    loop = asyncio.new_event_loop()
    try:
        extracted = loop.run_until_complete(
            analyze_job_text(
                text=job_text,
                source_url="https://example.com/jobs/1",
                source_type=SourceType.USER_PROVIDED,
                target_role="Lead QA Automation Architect",
            )
        )
    finally:
        loop.close()

    assert extracted["title"] == "Lead QA Automation Architect"


# ==============================================================================
# 5. End-to-End API Tests: Text, URL, and Combined Modes
# ==============================================================================

def test_api_extract_text_mode(client):
    """Tests POST /api/jobs/extract with direct text mode."""
    payload = {
        "text": "Stripe is seeking a Backend Engineer. Must build REST APIs in Python, use PostgreSQL databases, and write unit tests with pytest.",
        "target_role": "Backend Engineer",
        "mode": "text",
    }
    resp = client.post("/api/jobs/extract", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] is not None
    assert data["title"] == "Backend Engineer"
    assert data["input_mode"] == "text"
    assert data["extracted_at"] is not None
    assert len(data["requirements"]) >= 3


def test_api_extract_url_mode_mocked(client):
    """Tests POST /api/jobs/extract with public URL mode (mocked HTTP fetch)."""
    fake_html = """
    <html>
      <body>
        <h1>Postman - API Platform Engineer</h1>
        <p>Design high scale REST APIs using FastAPI and Python.</p>
        <p>Expertise in SQL databases and automated pytest suites required.</p>
        <p>Docker deployment is a plus.</p>
      </body>
    </html>
    """
    with patch("backend.app.routers.jobs.fetch_job_page", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = clean_html_to_text(fake_html)

        payload = {
            "url": "https://jobs.lever.co/postman/backend-engineer",
            "mode": "url",
        }
        resp = client.post("/api/jobs/extract", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["source_url"] == "https://jobs.lever.co/postman/backend-engineer"
        assert data["source_type"] == "fetched"
        assert data["input_mode"] == "url"
        assert any(r["taxonomy_key"] == "rest_api" for r in data["requirements"])


def test_api_extract_combined_mode_successful_merge(client):
    """Tests POST /api/jobs/extract with URL + pasted text combined."""
    fake_html = "Postman is seeking an Engineer with REST API and SQL database requirements."
    with patch("backend.app.routers.jobs.fetch_job_page", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = fake_html

        payload = {
            "url": "https://jobs.example.com/posting/123",
            "text": "Supplemental candidate notes: Must also have experience writing pytest unit tests and deploying with Docker.",
            "mode": "combined",
        }
        resp = client.post("/api/jobs/extract", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["input_mode"] == "combined"
        # Should contain requirements from both sources
        taxonomies = [r["taxonomy_key"] for r in data["requirements"]]
        assert "rest_api" in taxonomies
        assert "testing" in taxonomies
        assert any("Combined analysis" in note for note in data["ambiguities"])


def test_api_extract_combined_mode_anti_bot_fallback(client):
    """Tests that combined mode gracefully falls back to pasted text when URL fetch returns 403."""
    with patch("backend.app.routers.jobs.fetch_job_page", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.side_effect = JobFetchError("ANTI_BOT_BLOCKED", "LinkedIn anti-bot blocked scraper", retryable=False)

        payload = {
            "url": "https://www.linkedin.com/jobs/view/999999",
            "text": "Pasted description: Google is hiring a Python Software Engineer to build RESTful services and relational databases.",
            "mode": "combined",
        }
        resp = client.post("/api/jobs/extract", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["input_mode"] == "combined_fallback"
        assert data["source_url"] == "https://www.linkedin.com/jobs/view/999999"
        # Provenance and warning notes recorded
        assert any("Direct fetch encountered access limitations" in note for note in data["ambiguities"])
        taxonomies = [r["taxonomy_key"] for r in data["requirements"]]
        assert "rest_api" in taxonomies or "python" in taxonomies


def test_confirm_and_track_creation_flow(client):
    """Tests the full flow: Extract -> Confirm with edits -> Link Repo & Track."""
    # 1. Extract
    extract_resp = client.post(
        "/api/jobs/extract",
        json={
            "text": "Meta is seeking a Backend Engineer with Python, FastAPI REST APIs, and SQL database skills.",
            "mode": "text",
        },
    )
    assert extract_resp.status_code == 200
    job_data = extract_resp.json()
    job_id = job_data["id"]

    # 2. Confirm with modified priority and custom requirement
    reqs = job_data["requirements"]
    assert len(reqs) >= 1
    # Change first requirement priority to NICE
    reqs[0]["priority"] = "nice"
    # Add candidate-defined custom requirement
    reqs.append({
        "name": "Distributed Event Streaming",
        "category": "Backend Engineering",
        "priority": "must",
        "source_sentence": "Candidate defined custom requirement",
        "taxonomy_key": "distributed_streaming",
        "search_terms": ["kafka", "pubsub"],
        "position": len(reqs) + 1,
    })

    confirm_resp = client.put(
        f"/api/jobs/{job_id}/confirm",
        json={
            "title": "Senior Distributed Systems Engineer",
            "company": "Meta Platforms",
            "requirements": reqs,
            "confirmed": True,
        },
    )
    assert confirm_resp.status_code == 200
    confirmed_data = confirm_resp.json()
    assert confirmed_data["confirmed"] is True
    assert confirmed_data["title"] == "Senior Distributed Systems Engineer"
    assert confirmed_data["company"] == "Meta Platforms"
    assert any(r["name"] == "Distributed Event Streaming" for r in confirmed_data["requirements"])
