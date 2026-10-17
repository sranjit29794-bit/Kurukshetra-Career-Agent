"""Defect 4 integration tests: Resume Upload & Extraction.

Requirements tested:
1. python-multipart is used for multipart field "file".
2. resume_a.pdf yields GitHub repo via visible text.
3. resume_b.pdf yields GitHub repo via hyperlink annotation (/Annots -> /A -> /URI).
4. resume_c_scanned.pdf returns {status: "no_text"} and warning for scanned/image PDF.
5. Max size (>10MB) returns standard error envelope with HTTP 413.
6. Zero binary retention: SQLite database stores only claims and repo candidates, not PDF bytes or raw text.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from backend.app.db import SessionLocal
from backend.app.main import app
from backend.app.models import ResumeModel

DEMO_DIR = Path("docs/demo")


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_resume_a_upload_extracts_visible_github(client: TestClient) -> None:
    """resume_a.pdf must yield GitHub URL extracted from visible text."""
    pdf_path = DEMO_DIR / "resume_a.pdf"
    assert pdf_path.exists(), f"Missing fixture {pdf_path}"

    with open(pdf_path, "rb") as f:
        file_bytes = f.read()

    response = client.post(
        "/api/resume/parse",
        files={"file": ("resume_a.pdf", file_bytes, "application/pdf")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["filename"] == "resume_a.pdf"
    assert data["text_chars"] > 100
    assert len(data["claimed_skills"]) >= 3

    # Check extracted GitHub candidate
    repo_urls = [r["url"] for r in data["repo_candidates"]]
    assert "https://github.com/sranjit29794-bit/student-api" in repo_urls

    # Check that source is text
    text_candidate = next(
        r
        for r in data["repo_candidates"]
        if r["url"] == "https://github.com/sranjit29794-bit/student-api"
    )
    assert text_candidate["source"] == "text"


def test_resume_b_upload_extracts_hyperlink_annotation(client: TestClient) -> None:
    """resume_b.pdf must yield GitHub URL extracted from PDF /Annots hyperlink annotation."""
    pdf_path = DEMO_DIR / "resume_b.pdf"
    assert pdf_path.exists(), f"Missing fixture {pdf_path}"

    with open(pdf_path, "rb") as f:
        file_bytes = f.read()

    response = client.post(
        "/api/resume/parse",
        files={"file": ("resume_b.pdf", file_bytes, "application/pdf")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["filename"] == "resume_b.pdf"
    assert len(data["claimed_skills"]) >= 3

    # Check extracted GitHub candidate from hyperlink annotation
    repo_urls = [r["url"] for r in data["repo_candidates"]]
    assert "https://github.com/sranjit29794-bit/student-api" in repo_urls

    annot_candidate = next(
        r
        for r in data["repo_candidates"]
        if r["url"] == "https://github.com/sranjit29794-bit/student-api"
    )
    assert annot_candidate["source"] == "hyperlink"


def test_resume_c_scanned_returns_no_text_status(client: TestClient) -> None:
    """resume_c_scanned.pdf must return status: 'no_text' and instruct user to paste text."""
    pdf_path = DEMO_DIR / "resume_c_scanned.pdf"
    assert pdf_path.exists(), f"Missing fixture {pdf_path}"

    with open(pdf_path, "rb") as f:
        file_bytes = f.read()

    response = client.post(
        "/api/resume/parse",
        files={"file": ("resume_c_scanned.pdf", file_bytes, "application/pdf")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "no_text"
    assert data["text_chars"] < 20
    assert len(data["warnings"]) >= 1
    assert (
        "scanned" in data["warnings"][0].lower()
        or "selectable" in data["warnings"][0].lower()
    )


def test_resume_upload_exceeding_max_size_returns_413(client: TestClient) -> None:
    """File uploads exceeding 10MB limit must be rejected with 413 and standard error envelope."""
    oversized_bytes = b"%PDF" + b"0" * (10 * 1024 * 1024 + 1024)

    response = client.post(
        "/api/resume/parse",
        files={"file": ("huge_resume.pdf", oversized_bytes, "application/pdf")},
    )

    assert response.status_code == 413
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "FILE_TOO_LARGE"
    assert data["error"]["retryable"] is False


def test_resume_data_policy_no_pdf_stored_in_database(client: TestClient) -> None:
    """Verify DATA_POLICY: SQLite database stores ONLY claims and repos, not raw PDF bytes or text."""
    pdf_path = DEMO_DIR / "resume_a.pdf"
    with open(pdf_path, "rb") as f:
        file_bytes = f.read()

    response = client.post(
        "/api/resume/parse",
        files={"file": ("resume_a.pdf", file_bytes, "application/pdf")},
    )
    assert response.status_code == 200
    resume_id = response.json()["resume_id"]

    with SessionLocal() as db:
        saved_row = db.execute(
            select(ResumeModel).where(ResumeModel.id == resume_id)
        ).scalar_one_or_none()

        assert saved_row is not None
        assert saved_row.filename == "resume_a.pdf"
        # Zero raw text or PDF bytes retention
        assert saved_row.extracted_text == ""
        # Claims and candidate repos are retained
        assert len(saved_row.claimed_skills) >= 1
        assert len(saved_row.repo_candidates) >= 1
        assert not hasattr(saved_row, "pdf_bytes")
