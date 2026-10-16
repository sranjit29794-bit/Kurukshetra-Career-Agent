"""Async GitHub REST API client for DevProof.

Reference: docs/BRAIN.md (§7.3, §13, §14) and docs/PLAN-5H.md (Phase BE-1).
"""

from __future__ import annotations

import asyncio
import base64
from typing import Any

import httpx
from tenacity import (
    AsyncRetrying,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from backend.app.config import settings


class GitHubAPIError(Exception):
    """Normalized GitHub API error mapping to standard ErrorEnvelope."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        retryable: bool = False,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.retryable = retryable

    def to_dict(self) -> dict[str, Any]:
        """Convert error to standard ErrorEnvelope dictionary format."""
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "retryable": self.retryable,
            }
        }


def _is_retryable_exception(exc: BaseException) -> bool:
    """Determine whether an HTTP exception is retryable via tenacity."""
    if isinstance(exc, (httpx.TransportError, httpx.TimeoutException)):
        return True
    if isinstance(exc, httpx.HTTPStatusError):
        # 5xx server errors or 429 rate limit errors are retryable
        return exc.response.status_code in (429, 500, 502, 503, 504)
    if isinstance(exc, GitHubAPIError):
        return exc.retryable
    return False


class GitHubClient:
    """Async client for GitHub REST API v3 with ETag caching, rate tracking and retries."""

    def __init__(
        self,
        token: str | None = None,
        base_url: str = "https://api.github.com",
    ) -> None:
        self.token = token if token is not None else settings.GITHUB_TOKEN
        self.base_url = base_url.rstrip("/")
        self.rate_remaining: int = 5000 if self.token else 60
        self.rate_reset: int = 0
        self._etag_cache: dict[str, tuple[str, Any]] = {}
        self._blob_semaphore = asyncio.Semaphore(8)
        self._client: httpx.AsyncClient | None = None

    def _get_headers(self) -> dict[str, str]:
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "DevProof-Career-Agent",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    async def get_client(self) -> httpx.AsyncClient:
        """Lazily initialize and return the async httpx client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                headers=self._get_headers(),
                timeout=30.0,
            )
        return self._client

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    def should_pause_polling(self) -> bool:
        """Check whether rate limit is low (below 10), requiring polling pause."""
        return self.rate_remaining < 10

    def _update_rate_limits(self, response: httpx.Response) -> None:
        """Update tracked rate limits from GitHub response headers."""
        remaining = response.headers.get("x-ratelimit-remaining")
        if remaining is not None and remaining.isdigit():
            self.rate_remaining = int(remaining)

        reset = response.headers.get("x-ratelimit-reset")
        if reset is not None and reset.isdigit():
            self.rate_reset = int(reset)

    async def request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        json_data: Any | None = None,
        use_etag: bool = True,
    ) -> Any:
        """Execute HTTP request with tenacity exponential backoff and ETag handling."""
        req_headers = dict(headers or {})
        cache_key = f"{method}:{path}:{sorted(params.items()) if params else ''}"

        cached_etag, cached_body = None, None
        if use_etag and method.upper() == "GET" and cache_key in self._etag_cache:
            cached_etag, cached_body = self._etag_cache[cache_key]
            req_headers["If-None-Match"] = cached_etag

        client = await self.get_client()

        retryer = AsyncRetrying(
            stop=stop_after_attempt(3),
            wait=wait_exponential(multiplier=0.5, min=0.5, max=5.0),
            retry=retry_if_exception(_is_retryable_exception),
            reraise=True,
        )

        async for attempt in retryer:
            with attempt:
                try:
                    resp = await client.request(
                        method=method,
                        url=path,
                        params=params,
                        headers=req_headers,
                        json=json_data,
                    )
                except (httpx.TransportError, httpx.TimeoutException) as err:
                    raise GitHubAPIError(
                        code="GITHUB_UPSTREAM_ERROR",
                        message=f"Network error connecting to GitHub: {err}",
                        status_code=502,
                        retryable=True,
                    ) from err

                self._update_rate_limits(resp)

                if resp.status_code == 304 and cached_body is not None:
                    return cached_body

                if resp.status_code == 404:
                    raise GitHubAPIError(
                        code="REPO_NOT_FOUND",
                        message=f"GitHub repository or resource not found at {path}",
                        status_code=404,
                        retryable=False,
                    )

                if resp.status_code == 401:
                    raise GitHubAPIError(
                        code="REPO_PRIVATE",
                        message="Repository is private or authentication token is invalid",
                        status_code=401,
                        retryable=False,
                    )

                if resp.status_code == 403:
                    is_rate_limit = (
                        self.rate_remaining == 0
                        or "rate limit" in resp.text.lower()
                        or "secondary rate limit" in resp.text.lower()
                    )
                    if is_rate_limit:
                        raise GitHubAPIError(
                            code="RATE_LIMITED",
                            message="GitHub API rate limit exceeded",
                            status_code=429,
                            retryable=True,
                        )
                    raise GitHubAPIError(
                        code="REPO_PRIVATE",
                        message="Repository access forbidden or repository is private",
                        status_code=403,
                        retryable=False,
                    )

                if resp.status_code == 429:
                    raise GitHubAPIError(
                        code="RATE_LIMITED",
                        message="GitHub API secondary rate limit exceeded",
                        status_code=429,
                        retryable=True,
                    )

                if resp.status_code >= 500:
                    raise GitHubAPIError(
                        code="GITHUB_UPSTREAM_ERROR",
                        message=f"GitHub upstream error: {resp.status_code}",
                        status_code=502,
                        retryable=True,
                    )

                resp.raise_for_status()

                try:
                    data = resp.json()
                except (ValueError, TypeError):
                    data = resp.text

                etag = resp.headers.get("etag")
                if use_etag and etag and method.upper() == "GET":
                    self._etag_cache[cache_key] = (etag, data)

                return data

    async def get_repo(self, owner: str, name: str) -> dict[str, Any]:
        """Fetch repository metadata."""
        return await self.request("GET", f"/repos/{owner}/{name}")

    async def get_branch_commit(
        self, owner: str, name: str, branch: str
    ) -> dict[str, Any]:
        """Fetch HEAD commit info for a branch."""
        return await self.request("GET", f"/repos/{owner}/{name}/commits/{branch}")

    async def get_tree(
        self, owner: str, name: str, sha: str, recursive: bool = True
    ) -> dict[str, Any]:
        """Fetch git tree at specified commit SHA."""
        params = {"recursive": "1"} if recursive else {}
        return await self.request(
            "GET", f"/repos/{owner}/{name}/git/trees/{sha}", params=params
        )

    async def get_blob(self, owner: str, name: str, blob_sha: str) -> str:
        """Fetch and decode blob content at specified blob SHA with concurrency throttling."""
        async with self._blob_semaphore:
            data = await self.request(
                "GET", f"/repos/{owner}/{name}/git/blobs/{blob_sha}"
            )
            content_encoded = data.get("content", "")
            encoding = data.get("encoding", "")
            if encoding == "base64":
                raw_bytes = base64.b64decode(content_encoded)
                return raw_bytes.decode("utf-8", errors="replace")
            return content_encoded

    async def compare_commits(
        self, owner: str, name: str, base_sha: str, head_sha: str
    ) -> dict[str, Any]:
        """Compare two commit SHAs to retrieve files changed."""
        return await self.request(
            "GET", f"/repos/{owner}/{name}/compare/{base_sha}...{head_sha}"
        )

    async def get_user_repos(
        self, username: str, max_repos: int = 30
    ) -> list[dict[str, Any]]:
        """Fetch public repos for a user, sorted by recent push with non-forks prioritized."""
        params = {
            "type": "all",
            "sort": "pushed",
            "direction": "desc",
            "per_page": min(100, max_repos * 2),
        }
        raw_repos = await self.request("GET", f"/users/{username}/repos", params=params)
        if not isinstance(raw_repos, list):
            return []

        # Sort: non-forks first (False < True), then pushed_at desc
        public_repos = [r for r in raw_repos if not r.get("private", False)]
        public_repos.sort(
            key=lambda r: (1 if r.get("fork", False) else 0, -(r.get("id") or 0))
        )
        return public_repos[:max_repos]


# Shared global instance
_global_github_client: GitHubClient | None = None


def get_github_client() -> GitHubClient:
    """Obtain or initialize the global GitHub client instance."""
    global _global_github_client
    if _global_github_client is None:
        _global_github_client = GitHubClient()
    return _global_github_client
