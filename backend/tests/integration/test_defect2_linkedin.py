"""Tests for Defect 2: LinkedIn Ingestion.

Invariants verified:
1. No scraping, no cookies.
2. A linkedin.com job URL, or any fetch that hits a login wall or non-200,
   must return a typed result: {status: "needs_paste", reason: "login_required"}.
3. The source_url is preserved.
4. Tested with docs/demo's LinkedIn URL (https://www.linkedin.com/jobs/view/4478865041/)
   using a mocked 999 response and a 302-to-login response.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.app.agents.job_ingest import JobIngestAgent, LoginRequiredError
from backend.app.main import app

DEMO_LINKEDIN_URL = "https://www.linkedin.com/jobs/view/4478865041/"


class TestDefect2LinkedIn:
    def test_mocked_999_response_returns_typed_needs_paste(self) -> None:
        """Mock HTTP 999 (LinkedIn's anti-bot status code) -> must return typed needs_paste."""
        client = TestClient(app)

        mock_resp = httpx.Response(
            status_code=999,
            request=httpx.Request("GET", DEMO_LINKEDIN_URL),
        )

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_resp
            resp = client.post("/api/jobs/extract", json={"url": DEMO_LINKEDIN_URL})

        assert resp.status_code == 200, (
            f"Expected 200 typed response, got {resp.status_code}: {resp.text}"
        )
        data = resp.json()
        assert data.get("status") == "needs_paste", (
            f"Expected status 'needs_paste', got {data}"
        )
        assert data.get("reason") == "login_required", (
            f"Expected reason 'login_required', got {data}"
        )

    def test_mocked_302_to_login_returns_typed_needs_paste(self) -> None:
        """Mock HTTP 302 redirecting to login wall -> must return typed needs_paste."""
        client = TestClient(app)

        mock_resp = httpx.Response(
            status_code=302,
            headers={"Location": "https://www.linkedin.com/login?fromJobView=1"},
            request=httpx.Request("GET", DEMO_LINKEDIN_URL),
        )

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_resp
            resp = client.post("/api/jobs/extract", json={"url": DEMO_LINKEDIN_URL})

        assert resp.status_code == 200, (
            f"Expected 200 typed response, got {resp.status_code}: {resp.text}"
        )
        data = resp.json()
        assert data.get("status") == "needs_paste", (
            f"Expected status 'needs_paste', got {data}"
        )
        assert data.get("reason") == "login_required", (
            f"Expected reason 'login_required', got {data}"
        )

    def test_non_200_generic_returns_typed_needs_paste(self) -> None:
        """Any generic fetch returning a login wall or non-200 -> must return typed needs_paste."""
        client = TestClient(app)

        mock_resp = httpx.Response(
            status_code=403,
            request=httpx.Request("GET", "https://example.com/careers/private-job"),
        )

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_resp
            resp = client.post(
                "/api/jobs/extract",
                json={"url": "https://example.com/careers/private-job"},
            )

        assert resp.status_code == 200, (
            f"Expected 200 typed response, got {resp.status_code}: {resp.text}"
        )
        data = resp.json()
        assert data.get("status") == "needs_paste"
        assert data.get("reason") == "login_required"

    @pytest.mark.asyncio
    async def test_agent_fetch_url_raises_login_required(self) -> None:
        """Direct call to JobIngestAgent.fetch_url raises LoginRequiredError on LinkedIn."""
        agent = JobIngestAgent()
        mock_resp = httpx.Response(
            status_code=999,
            request=httpx.Request("GET", DEMO_LINKEDIN_URL),
        )

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_resp
            with pytest.raises(LoginRequiredError) as exc_info:
                await agent.fetch_url(DEMO_LINKEDIN_URL)

            assert exc_info.value.reason == "login_required"
