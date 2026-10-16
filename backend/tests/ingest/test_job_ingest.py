"""Tests for Phase IN-2: Job Ingestion and Requirements Extraction.

Reference: docs/BRAIN.md (§11, §12) and docs/PLAN-5H.md (Phase IN-2).
Invariants verified:
- Greenhouse boards API unescapes entities and extracts clean requirements.
- Lever API handles EU fallback.
- LinkedIn hits login wall and returns clear 'paste the text' guidance without scraping.
- Real pasted job text from docs/demo/job_paste.txt extracts core skills with Must vs Nice priority.
- Clean error envelope on 404/deleted posting or invalid input.
- ClaimsMatrix endpoint returns matrix across tracks.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import respx
from fastapi.testclient import TestClient

from backend.app.agents.job_ingest import JobIngestError, job_ingest
from backend.app.main import app
from backend.app.schemas import Priority, SourceType


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


class TestJobIngestAgent:
    @respx.mock
    @pytest.mark.asyncio
    async def test_greenhouse_fetch_and_unescape(self) -> None:
        api_url = "https://boards-api.greenhouse.io/v1/boards/doordashusa/jobs/8171041"
        respx.get(api_url).respond(
            200,
            json={
                "id": 8171041,
                "title": "Software Engineer, Intern",
                "company_name": "DoorDash",
                "content": (
                    "&lt;div&gt;&lt;p&gt;We are looking for engineers with experience in "
                    "Python and REST APIs.&lt;/p&gt;&lt;p&gt;Preferred: experience with Docker "
                    "and CI/CD pipelines.&lt;/p&gt;&lt;/div&gt;"
                ),
            },
        )

        url = "https://job-boards.greenhouse.io/doordashusa/jobs/8171041"
        title, company, clean_text, detail = await job_ingest.fetch_url(url)

        assert title == "Software Engineer, Intern"
        assert company == "DoorDash"
        assert "<div" not in clean_text
        assert "Python" in clean_text
        assert "REST APIs" in clean_text

        draft = job_ingest.extract_requirements(
            title=title,
            company=company,
            text_content=clean_text,
            source_url=url,
            source_type=SourceType.fetched,
        )
        assert len(draft.requirements) >= 2
        tax_keys = {r.taxonomy_key: r for r in draft.requirements}
        assert "python_lang" in tax_keys
        assert "rest_api" in tax_keys
        assert tax_keys["python_lang"].priority == Priority.must

    @respx.mock
    @pytest.mark.asyncio
    async def test_greenhouse_not_found_returns_error(self) -> None:
        api_url = "https://boards-api.greenhouse.io/v1/boards/doordashusa/jobs/9999999"
        respx.get(api_url).respond(404)

        with pytest.raises(JobIngestError) as exc_info:
            await job_ingest.fetch_url(
                "https://job-boards.greenhouse.io/doordashusa/jobs/9999999"
            )

        assert exc_info.value.code == "NOT_FOUND"
        assert exc_info.value.status_code == 404

    @respx.mock
    @pytest.mark.asyncio
    async def test_lever_fetch_with_eu_fallback(self) -> None:
        us_url = "https://api.lever.co/v0/postings/acme/post-abc"
        eu_url = "https://api.eu.lever.co/v0/postings/acme/post-abc"

        # US returns 404, EU returns 200
        respx.get(us_url).respond(404)
        respx.get(eu_url).respond(
            200,
            json={
                "id": "post-abc",
                "text": "Backend Engineer",
                "categories": {"team": "Acme Corp"},
                "descriptionPlain": "Build scalable services in Python using SQL databases and write pytest suites.",
            },
        )

        title, company, clean_text, detail = await job_ingest.fetch_url(
            "https://jobs.lever.co/acme/post-abc"
        )
        assert title == "Backend Engineer"
        assert company == "Acme Corp"
        assert "Python" in clean_text

        draft = job_ingest.extract_requirements(
            title=title,
            company=company,
            text_content=clean_text,
            source_url="https://jobs.lever.co/acme/post-abc",
            source_type=SourceType.fetched,
        )
        tax_keys = {r.taxonomy_key for r in draft.requirements}
        assert "python_lang" in tax_keys
        assert "sql_database" in tax_keys
        assert "testing" in tax_keys

    @pytest.mark.asyncio
    async def test_linkedin_url_triggers_login_wall_guidance(self) -> None:
        linkedin_url = "https://www.linkedin.com/jobs/view/4478865041/"
        with pytest.raises(JobIngestError) as exc_info:
            await job_ingest.fetch_url(linkedin_url)

        assert exc_info.value.code == "LOGIN_WALL"
        assert "login authentication" in exc_info.value.message.lower()
        assert "paste text" in exc_info.value.message.lower()

    def test_pasted_job_from_demo_file(self) -> None:
        demo_paste_file = Path("docs/demo/job_paste.txt")
        assert demo_paste_file.exists(), "docs/demo/job_paste.txt must exist"
        raw_text = demo_paste_file.read_text(encoding="utf-8")

        draft = job_ingest.extract_requirements(
            title="Software Engineer, Intern (Summer 2027) - US",
            company="DoorDash",
            text_content=raw_text,
            source_url="https://job-boards.greenhouse.io/doordashusa/jobs/8171041",
            source_type=SourceType.user_provided,
            source_detail="User-provided job description",
        )

        assert draft.source_type == SourceType.user_provided
        assert (
            "https://job-boards.greenhouse.io/doordashusa/jobs/8171041"
            in draft.source_url
        )
        assert len(draft.requirements) >= 4

        req_map = {r.taxonomy_key: r for r in draft.requirements}
        # Required core skills from DoorDash posting
        assert "sql_database" in req_map
        assert "python_lang" in req_map
        assert "testing" in req_map
        assert req_map["sql_database"].priority == Priority.must
        assert req_map["testing"].priority == Priority.must

        # Preferred skills from DoorDash posting
        if "ci_cd" in req_map:
            assert req_map["ci_cd"].priority == Priority.nice
        if "rest_api" in req_map:
            assert req_map["rest_api"].priority == Priority.nice


class TestJobEndpoints:
    def test_extract_pasted_text_endpoint(self, client: TestClient) -> None:
        payload = {
            "raw_text": (
                "Source: https://jobs.example.com/posting/123\n\n"
                "Software Engineer\nAcme Systems\n\n"
                "We need strong Python developers who build REST APIs and write tests.\n"
                "Preferred: Docker and Kubernetes deployment."
            )
        }
        resp = client.post("/api/jobs/extract", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["source_type"] == "user_provided"
        assert "https://jobs.example.com/posting/123" in data["source_url"]
        assert len(data["requirements"]) >= 3

    def test_extract_linkedin_endpoint_returns_login_wall(
        self, client: TestClient
    ) -> None:
        payload = {"url": "https://www.linkedin.com/jobs/view/4478865041/"}
        resp = client.post("/api/jobs/extract", json=payload)
        assert resp.status_code == 400
        err = resp.json()
        assert "error" in err
        assert err["error"]["code"] == "LOGIN_WALL"
        assert not err["error"]["retryable"]

    def test_crud_job_and_claims_matrix(self, client: TestClient) -> None:
        # 1. Extract job
        extract_resp = client.post(
            "/api/jobs/extract",
            json={
                "raw_text": (
                    "Backend Developer at TestCorp\n"
                    "Requirements: Python programming and PostgreSQL database experience.\n"
                    "Preferred: Docker deployment."
                ),
                "title": "Backend Developer",
                "company": "TestCorp",
            },
        )
        assert extract_resp.status_code == 200
        draft = extract_resp.json()

        # 2. Save job (POST /api/jobs)
        create_resp = client.post("/api/jobs", json=draft)
        assert create_resp.status_code == 200
        saved_job = create_resp.json()
        job_id = saved_job["id"]

        # 3. Get job (GET /api/jobs/{id})
        get_resp = client.get(f"/api/jobs/{job_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["id"] == job_id
        assert len(get_resp.json()["requirements"]) >= 2

        # 4. Get Claims Matrix (GET /api/jobs/{id}/claims-matrix)
        matrix_resp = client.get(f"/api/jobs/{job_id}/claims-matrix")
        assert matrix_resp.status_code == 200
        matrix = matrix_resp.json()
        assert matrix["job_id"] == job_id
        assert "rows" in matrix
        assert len(matrix["rows"]) >= 2

        # 5. Invalid job id returns 404 envelope
        bad_resp = client.get("/api/jobs/nonexistent_job_12345")
        assert bad_resp.status_code == 404
        assert bad_resp.json()["error"]["code"] == "NOT_FOUND"
