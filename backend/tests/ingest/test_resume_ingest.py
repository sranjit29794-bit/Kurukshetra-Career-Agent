"""Unit tests for Phase IN-3: Resume Ingestion and Claims Extraction.

Reference: docs/BRAIN.md (§9, §11, §12) and docs/PLAN-5H.md (Phase IN-3).
Invariants verified:
- resume_a.pdf: visible GitHub link in text extracted.
- resume_b.pdf: GitHub link in PDF hyperlink annotations (/Annots) extracted.
- resume_c_scanned.pdf: zero-text detected with clear warning (no hallucinated skills).
- Claims extracted with line numbers as E0 claims.
- Endpoints support both multipart PDF uploads and JSON text paste.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app.agents.resume_ingest import resume_ingest
from backend.app.main import app
from backend.app.schemas import RepoCandidateKind, RepoCandidateSource


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


class TestResumeIngestAgent:
    def test_resume_a_visible_github_link(self) -> None:
        path = Path("docs/demo/resume_a.pdf")
        assert path.exists(), "resume_a.pdf must exist"

        file_bytes = path.read_bytes()
        draft = resume_ingest.parse_pdf(file_bytes=file_bytes, filename="resume_a.pdf")

        assert draft.text_chars > 100
        assert len(draft.warnings) == 0

        # Check GitHub repo candidate extracted from visible text
        assert len(draft.repo_candidates) >= 1
        cand = next(
            (r for r in draft.repo_candidates if r.owner == "sranjit29794-bit"), None
        )
        assert cand is not None
        assert cand.name == "student-api"
        assert cand.source == RepoCandidateSource.text
        assert cand.kind == RepoCandidateKind.repo

        # Check claimed skills
        claim_keys = {c.taxonomy_key for c in draft.claimed_skills}
        assert "python_lang" in claim_keys
        assert "rest_api" in claim_keys
        assert "sql_database" in claim_keys
        assert "testing" in claim_keys
        assert "deployment" in claim_keys

    def test_resume_b_hyperlink_annotation(self) -> None:
        path = Path("docs/demo/resume_b.pdf")
        assert path.exists(), "resume_b.pdf must exist"

        file_bytes = path.read_bytes()
        draft = resume_ingest.parse_pdf(file_bytes=file_bytes, filename="resume_b.pdf")

        assert draft.text_chars > 100
        assert len(draft.warnings) == 0

        # In resume_b, visible text only has 'GitHub', but annotation has the URL
        assert len(draft.repo_candidates) >= 1
        cand = next(
            (r for r in draft.repo_candidates if r.owner == "sranjit29794-bit"), None
        )
        assert cand is not None
        assert cand.name == "student-api"
        assert cand.source == RepoCandidateSource.hyperlink

        # Check claimed skills
        claim_keys = {c.taxonomy_key for c in draft.claimed_skills}
        assert "python_lang" in claim_keys
        assert "sql_database" in claim_keys

    def test_resume_c_scanned_image_only_warning(self) -> None:
        path = Path("docs/demo/resume_c_scanned.pdf")
        assert path.exists(), "resume_c_scanned.pdf must exist"

        file_bytes = path.read_bytes()
        draft = resume_ingest.parse_pdf(
            file_bytes=file_bytes, filename="resume_c_scanned.pdf"
        )

        assert draft.text_chars < 20
        assert len(draft.claimed_skills) == 0
        assert len(draft.warnings) >= 1
        warning = draft.warnings[0].lower()
        assert "no selectable text" in warning
        assert "scanned or image-only" in warning
        assert "paste resume text" in warning

    def test_parse_raw_text(self) -> None:
        text = """John Doe
Senior Software Engineer
Skills: Python, FastAPI, Docker, PostgreSQL, Pytest
Projects:
Task Manager: https://github.com/johndoe/task-manager
"""
        draft = resume_ingest.parse_text(text=text)
        assert draft.text_chars > 50
        assert len(draft.warnings) == 0
        assert len(draft.repo_candidates) == 1
        cand = draft.repo_candidates[0]
        assert cand.owner == "johndoe"
        assert cand.name == "task-manager"

        claim_keys = {c.taxonomy_key for c in draft.claimed_skills}
        assert "python_lang" in claim_keys
        assert "sql_database" in claim_keys
        assert "deployment" in claim_keys


class TestResumeEndpoints:
    def test_parse_json_text_endpoint(self, client: TestClient) -> None:
        payload = {
            "text": "Asha Verma\nSkills: Python, SQL, REST APIs\nProjects: github.com/testuser/demo-repo"
        }
        resp = client.post("/api/resume/parse", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["resume_id"].startswith("resume_")
        assert len(data["claimed_skills"]) >= 3
        assert len(data["repo_candidates"]) == 1

        resume_id = data["resume_id"]
        # Retrieve via GET /api/resume/{id}
        get_resp = client.get(f"/api/resume/{resume_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["resume_id"] == resume_id

    def test_parse_multipart_pdf_endpoint(self, client: TestClient) -> None:
        path = Path("docs/demo/resume_b.pdf")
        with path.open("rb") as f:
            resp = client.post(
                "/api/resume/parse",
                files={"file": ("resume_b.pdf", f, "application/pdf")},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["resume_id"].startswith("resume_")
        assert len(data["repo_candidates"]) >= 1
        assert data["repo_candidates"][0]["source"] == "hyperlink"

    def test_get_nonexistent_resume_returns_404(self, client: TestClient) -> None:
        resp = client.get("/api/resume/resume_nonexistent_9999")
        assert resp.status_code == 404
        assert resp.json()["error"]["code"] == "NOT_FOUND"
