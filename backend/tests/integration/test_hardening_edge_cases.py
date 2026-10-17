"""Hardening and Edge-Case Test Suite (BRAIN §17 & Phase 10).

Covers edge cases across the entire stack:
1. LLM down / timeout fallback to deterministic mode (ai_used=False)
2. LLM invalid JSON response repair and fallback
3. GitHub rate-limited (403 / 429) clean error envelope
4. GitHub 5xx server error handling with retryable error envelope
5. Upstream job posting 404 (deleted/invalid) clean error response
6. Duplicate webhook delivery deduplication and idempotency
7. Unrelated commit (docs/README only) impacts 0 skills and carries forward
8. Non-Python repo returns clean NOT_DEMONSTRATED with 0 supported files
9. Secret hygiene verification (no hardcoded tokens/keys in repo)

Reference: docs/BRAIN.md (§3, §17) and docs/PLAN-5H.md (Phase 10).
"""

from __future__ import annotations

import hashlib
import hmac
import json
import re
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
import respx
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.agents.evidence_judge import LLMReviewOutput
from backend.app.config import settings
from backend.app.db import get_db
from backend.app.github.client import GitHubAPIError, GitHubClient
from backend.app.llm.client import LLMClient, LLMError
from backend.app.main import app
from backend.app.models import WebhookDeliveryModel
from backend.app.schemas import RequirementIn, Status
from backend.app.services.impact_map import compute_impact
from backend.tests.fixtures.loader import load_repo_fixture_snapshot


def compute_webhook_signature(payload_bytes: bytes, secret: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def db_session() -> Session:
    return next(get_db())


class TestEdgeCaseHardening:
    """Test battery against edge-case matrix (BRAIN §17)."""

    # -------------------------------------------------------------
    # 1. LLM Down Fallback
    # -------------------------------------------------------------
    @pytest.mark.asyncio
    async def test_llm_down_auto_degrades_to_deterministic(self) -> None:
        """Edge Case 1: When LLM provider is down or times out, engine falls back to deterministic."""
        snapshot = load_repo_fixture_snapshot("student_api", "c0")
        req = RequirementIn(
            id="req_rest",
            name="REST API",
            category="Backend",
            source_sentence="Build REST API",
            taxonomy_key="rest_api",
        )

        with patch(
            "backend.app.llm.client.LLMClient.complete_json",
            side_effect=LLMError("Connection timed out"),
        ):
            from backend.app.engine_facade import engine_facade

            assessments = await engine_facade.assess(snapshot, [req])

            assert len(assessments) == 1
            asmt = assessments[0]
            # Must still produce valid deterministic verdict
            assert asmt.status == Status.DEMONSTRATED
            assert "verified implementation evidence" in asmt.summary.lower()
            assert len(asmt.cited_signal_ids) > 0

    # -------------------------------------------------------------
    # 2. LLM Invalid JSON
    # -------------------------------------------------------------
    @pytest.mark.asyncio
    async def test_llm_invalid_json_fallback(self) -> None:
        """Edge Case 2: When LLM returns malformed JSON, LLMClient retries and raises LLMError on failure."""
        client = LLMClient()
        mock_client = AsyncMock()
        mock_create = AsyncMock()
        mock_choice = AsyncMock()
        mock_choice.message.content = "Not a JSON: {unclosed brackets"
        mock_create.return_value.choices = [mock_choice]
        mock_client.chat.completions.create = mock_create
        client._client = mock_client

        with pytest.raises(LLMError) as exc_info:
            await client.complete_json("system", "user", LLMReviewOutput)

        assert "Schema validation failed" in str(exc_info.value) or "JSON" in str(
            exc_info.value
        )

    # -------------------------------------------------------------
    # 3. GitHub Rate-Limited
    # -------------------------------------------------------------
    @pytest.mark.asyncio
    @respx.mock
    async def test_github_rate_limited_error_envelope(self) -> None:
        """Edge Case 3: When GitHub API returns 403 with rate limit exceeded, returns structured error envelope."""
        respx.get("https://api.github.com/repos/test-org/rate-limited-repo").respond(
            status_code=403,
            headers={"x-ratelimit-remaining": "0", "x-ratelimit-reset": "1700000000"},
            json={"message": "API rate limit exceeded"},
        )

        gh = GitHubClient(token="fake_token")
        with pytest.raises(GitHubAPIError) as exc_info:
            await gh.get_repo("test-org", "rate-limited-repo")

        err = exc_info.value
        assert err.status_code in (403, 429)
        assert err.code == "RATE_LIMITED"
        err_dict = err.to_dict()
        assert "error" in err_dict
        assert err_dict["error"]["code"] == "RATE_LIMITED"
        assert err_dict["error"]["retryable"] is True

    # -------------------------------------------------------------
    # 4. GitHub 5xx Server Error
    # -------------------------------------------------------------
    @pytest.mark.asyncio
    @respx.mock
    async def test_github_5xx_server_error_envelope(self) -> None:
        """Edge Case 4: When GitHub API returns 500/502/503, returns retryable error envelope."""
        respx.get("https://api.github.com/repos/test-org/broken-repo").respond(
            status_code=502,
            text="Bad Gateway",
        )

        gh = GitHubClient(token="fake_token")
        with pytest.raises(GitHubAPIError) as exc_info:
            await gh.get_repo("test-org", "broken-repo")

        err = exc_info.value
        assert err.status_code == 502
        assert err.code == "GITHUB_UPSTREAM_ERROR"
        assert err.to_dict()["error"]["retryable"] is True

    # -------------------------------------------------------------
    # 5. Upstream Deleted Job Posting (404)
    # -------------------------------------------------------------
    @respx.mock
    def test_deleted_job_posting_clean_error(self, client: TestClient) -> None:
        """Edge Case 5: When Greenhouse/Lever job URL is 404, returns clean error state, not crash."""
        respx.get(
            "https://boards-api.greenhouse.io/v1/boards/nonexistent/jobs/999999"
        ).respond(
            status_code=404,
            json={"error": "Not Found"},
        )

        resp = client.post(
            "/api/jobs/extract",
            json={"url": "https://boards.greenhouse.io/nonexistent/jobs/999999"},
        )
        assert resp.status_code == 404
        data = resp.json()
        assert "error" in data
        assert data["error"]["code"] in ("UPSTREAM_POSTING_NOT_FOUND", "NOT_FOUND")
        assert data["error"]["retryable"] is False

    # -------------------------------------------------------------
    # 6. Duplicate Webhook Delivery Idempotency
    # -------------------------------------------------------------
    def test_duplicate_webhook_delivery_idempotency(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Edge Case 6: Duplicate delivery ID is skipped and does not re-run pipeline."""
        import uuid

        delivery_id = f"delivery_dedupe_{uuid.uuid4().hex[:12]}"
        payload = {
            "ref": "refs/heads/main",
            "before": "0000000000000000000000000000000000000000",
            "after": "1111111111111111111111111111111111111111",
            "repository": {
                "owner": {"login": "test-owner"},
                "name": "test-repo",
            },
            "commits": [],
        }
        body = json.dumps(payload).encode("utf-8")
        sig = compute_webhook_signature(body, settings.GITHUB_WEBHOOK_SECRET)

        # Pre-seed delivery in DB
        db_session.add(
            WebhookDeliveryModel(
                delivery_id=delivery_id,
                event="push",
                sha="1111111111111111111111111111111111111111",
                outcome="processed",
            )
        )
        db_session.commit()

        # Inbound request with same delivery ID
        resp = client.post(
            "/api/webhooks/github",
            content=body,
            headers={
                "Content-Type": "application/json",
                "X-GitHub-Event": "push",
                "X-GitHub-Delivery": delivery_id,
                "X-Hub-Signature-256": sig,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ignored"
        assert data["delivery_id"] == delivery_id

    # -------------------------------------------------------------
    # 7. Unrelated Commit (README/docs only) No Skill Reassessment
    # -------------------------------------------------------------
    def test_unrelated_commit_impact_empty(self) -> None:
        """Edge Case 7: Commit touching only documentation/CI workflows doesn't impact core skill code."""
        impact = compute_impact(
            changed_files=["README.md", "docs/architecture.md", "docs/notes.txt"],
        )
        assert len(impact.affected_keys) == 0
        assert impact.is_docs_only is True
        assert impact.reason == "docs only: no skill change"

    # -------------------------------------------------------------
    # 8. Non-Python Repository Analysis
    # -------------------------------------------------------------
    @pytest.mark.asyncio
    async def test_non_python_repo_clean_handling(self) -> None:
        """Edge Case 8: Non-Python repository returns clean NOT_DEMONSTRATED and notes 0 supported files."""
        snapshot = load_repo_fixture_snapshot("non_python_repo", "")
        assert len(snapshot.files) == 0
        assert snapshot.scope.analyzed == 0

        req = RequirementIn(
            id="req_python",
            name="Python Language",
            category="Language",
            source_sentence="Proficient in Python",
            taxonomy_key="python_language",
        )

        from backend.app.engine_facade import engine_facade

        assessments = await engine_facade.assess(snapshot, [req])
        assert len(assessments) == 1
        asmt = assessments[0]
        assert asmt.status == Status.NOT_DEMONSTRATED
        assert asmt.strength.value == "none"
        assert len(asmt.cited_signal_ids) == 0

    # -------------------------------------------------------------
    # 9. Secret Hygiene Verification
    # -------------------------------------------------------------
    def test_secret_hygiene_no_leaked_credentials(self) -> None:
        """Edge Case 9: Confirm no live API keys or tokens are hardcoded into tracked files."""
        root_dir = Path(__file__).resolve().parent.parent.parent.parent
        secret_patterns = [
            re.compile(r"ghp_[A-Za-z0-9_]{36}"),
            re.compile(r"sk-[A-Za-z0-9_]{48}"),
            re.compile(r"AKIA[0-9A-Z]{16}"),
        ]

        # Scan backend/app and frontend/src
        scan_dirs = [root_dir / "backend" / "app", root_dir / "frontend" / "src"]
        for sdir in scan_dirs:
            if not sdir.exists():
                continue
            for file_path in sdir.rglob("*"):
                if file_path.is_file() and file_path.suffix in (
                    ".py",
                    ".ts",
                    ".tsx",
                    ".js",
                    ".json",
                ):
                    content = file_path.read_text(encoding="utf-8", errors="ignore")
                    for pattern in secret_patterns:
                        match = pattern.search(content)
                        assert match is None, (
                            f"Potential credential pattern {pattern.pattern} found in {file_path}"
                        )
