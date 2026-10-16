import base64
import re
from typing import Any, Dict, List, Optional, Tuple
import httpx

from backend.app.config import get_settings
from backend.app.github.files import filter_tree_files
from backend.app.schemas import RepoConnectResult, Scope, WebhookStatus


class GitHubError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400, retryable: bool = False):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.retryable = retryable


class InvalidRepoUrlError(GitHubError):
    def __init__(self, message: str = "Invalid GitHub repository URL format"):
        super().__init__(code="INVALID_REPO_URL", message=message, status_code=400, retryable=False)


class RepoNotFoundError(GitHubError):
    def __init__(self, message: str = "Repository not found or private (public repos supported in MVP)"):
        super().__init__(code="REPO_NOT_FOUND_OR_PRIVATE", message=message, status_code=404, retryable=False)


class RateLimitError(GitHubError):
    def __init__(self, message: str = "GitHub API rate limit exceeded", reset_epoch: Optional[int] = None):
        super().__init__(code="GITHUB_RATE_LIMITED", message=message, status_code=429, retryable=True)
        self.reset_epoch = reset_epoch


class InvalidTokenError(GitHubError):
    def __init__(self, message: str = "GitHub API rejected credentials (401 Unauthorized)"):
        super().__init__(code="GITHUB_INVALID_TOKEN", message=message, status_code=401, retryable=False)


class EmptyRepoError(GitHubError):
    def __init__(self, message: str = "Repository is empty and contains no commits"):
        super().__init__(code="EMPTY_REPOSITORY", message=message, status_code=422, retryable=False)


def parse_github_url(url: str) -> Tuple[str, str]:
    """Parses various GitHub repository URL formats into (owner, repo).

    Examples:
        - https://github.com/rohan-dev/student-api -> ('rohan-dev', 'student-api')
        - https://github.com/rohan-dev/student-api.git -> ('rohan-dev', 'student-api')
        - github.com/rohan-dev/student-api -> ('rohan-dev', 'student-api')
        - rohan-dev/student-api -> ('rohan-dev', 'student-api')
    """
    if not url or not isinstance(url, str):
        raise InvalidRepoUrlError("Repository URL cannot be empty")

    clean_url = url.strip()

    # Pattern matching https?://github.com/owner/repo or github.com/owner/repo
    url_pattern = re.compile(
        r"^(?:https?://)?(?:www\.)?github\.com/([a-zA-Z0-9_.-]+)/([a-zA-Z0-9_.-]+?)(?:\.git)?(?:/.*)?$"
    )
    match = url_pattern.match(clean_url)
    if match:
        owner, repo = match.group(1), match.group(2)
        return owner, repo

    # Pattern matching plain owner/repo
    short_pattern = re.compile(r"^([a-zA-Z0-9_.-]+)/([a-zA-Z0-9_.-]+?)(?:\.git)?/?$")
    short_match = short_pattern.match(clean_url)
    if short_match:
        owner, repo = short_match.group(1), short_match.group(2)
        return owner, repo

    raise InvalidRepoUrlError(f"Could not parse '{clean_url}' as a valid GitHub repository URL")


class GitHubClient:
    """Async GitHub REST API v3 client with rate-limiting, tree recursion,

    and strict non-execution of code.
    """

    BASE_URL = "https://api.github.com"

    def __init__(self, token: Optional[str] = None, timeout: float = 20.0):
        settings = get_settings()
        self.token = token if token is not None else settings.GITHUB_TOKEN
        self.timeout = timeout

    @property
    def headers(self) -> Dict[str, str]:
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "DevProof-Career-Agent/0.1.0",
        }
        if self.token:
            clean_token = self.token.strip()
            headers["Authorization"] = f"Bearer {clean_token}"
        return headers

    def _check_rate_limit(self, response: httpx.Response) -> None:
        if response.status_code == 401:
            raise InvalidTokenError(
                "GitHub API rejected server token (401 Unauthorized). Check that GITHUB_TOKEN in server .env is valid and not expired or revoked."
            )

        limit_header = response.headers.get("X-RateLimit-Limit")
        remaining = response.headers.get("X-RateLimit-Remaining")
        reset_header = response.headers.get("X-RateLimit-Reset")
        reset_epoch = int(reset_header) if reset_header and reset_header.isdigit() else None

        is_rate_limited = (
            (response.status_code == 403 and remaining == "0")
            or response.status_code == 429
            or (response.status_code == 403 and "rate limit" in response.text.lower())
        )
        if is_rate_limited:
            reset_msg = ""
            if reset_epoch:
                import datetime
                reset_dt = datetime.datetime.fromtimestamp(reset_epoch, tz=datetime.timezone.utc)
                reset_msg = f" Rate limit resets at {reset_dt.strftime('%H:%M:%S UTC')}."

            # Delineate using actual header when present:
            # GitHub sets X-RateLimit-Limit: 60 for unauthenticated, >= 1000 for authenticated tokens
            is_unauthenticated = (limit_header == "60") or (not limit_header and not self.token)

            if is_unauthenticated:
                message = f"GitHub API unauthenticated rate limit (60 req/h) exceeded.{reset_msg} Set GITHUB_TOKEN in server .env for 5,000 req/h."
            else:
                limit_display = f"{int(limit_header):,} req/h" if (limit_header and limit_header.isdigit()) else "5,000 req/h"
                message = f"GitHub API authenticated rate limit ({limit_display}) exceeded.{reset_msg}"

            raise RateLimitError(
                message,
                reset_epoch=reset_epoch,
            )

    async def get_rate_limit(self) -> Dict[str, Any]:
        """Queries /rate_limit safely. Never throws RateLimitError."""
        url = f"{self.BASE_URL}/rate_limit"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers=self.headers)
                if resp.status_code == 200:
                    data = resp.json().get("rate", {})
                    return {
                        "authenticated": bool(self.token),
                        "limit": data.get("limit", 5000 if self.token else 60),
                        "remaining": data.get("remaining"),
                        "reset_epoch": data.get("reset"),
                    }
        except Exception:
            pass

        return {
            "authenticated": bool(self.token),
            "limit": 5000 if self.token else 60,
            "remaining": None,
            "reset_epoch": None,
        }

    async def get_repo_metadata(self, owner: str, repo: str) -> Dict[str, Any]:
        """Fetches repository metadata from GET /repos/{owner}/{repo}."""
        url = f"{self.BASE_URL}/repos/{owner}/{repo}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(url, headers=self.headers)
            self._check_rate_limit(resp)

            if resp.status_code == 404:
                raise RepoNotFoundError(f"Repository '{owner}/{repo}' not found or is private.")
            if resp.status_code == 409:
                raise EmptyRepoError(f"Repository '{owner}/{repo}' is empty.")
            if resp.status_code != 200:
                raise GitHubError(
                    code="GITHUB_API_ERROR",
                    message=f"GitHub API error ({resp.status_code}): {resp.text}",
                    status_code=resp.status_code,
                    retryable=resp.status_code >= 500,
                )

            return resp.json()

    async def get_branch_head_sha(self, owner: str, repo: str, branch: str) -> str:
        """Resolves the exact 40-character commit SHA for a branch via GET /repos/{owner}/{repo}/commits/{branch}."""
        url = f"{self.BASE_URL}/repos/{owner}/{repo}/commits/{branch}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(url, headers=self.headers)
            self._check_rate_limit(resp)

            if resp.status_code == 404:
                raise GitHubError(
                    code="BRANCH_NOT_FOUND",
                    message=f"Branch '{branch}' not found on repository '{owner}/{repo}'.",
                    status_code=404,
                )
            if resp.status_code != 200:
                raise GitHubError(
                    code="GITHUB_API_ERROR",
                    message=f"Failed to resolve branch commit ({resp.status_code}): {resp.text}",
                    status_code=resp.status_code,
                    retryable=resp.status_code >= 500,
                )

            data = resp.json()
            sha = data.get("sha")
            if not sha:
                raise EmptyRepoError(f"Branch '{branch}' does not contain any commit SHA.")
            return sha

    async def get_tree(self, owner: str, repo: str, commit_sha: str) -> Tuple[List[Dict[str, Any]], bool]:
        """Fetches recursive tree at SHA via GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1.

        Returns (tree_entries, truncated_bool).
        """
        url = f"{self.BASE_URL}/repos/{owner}/{repo}/git/trees/{commit_sha}?recursive=1"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(url, headers=self.headers)
            self._check_rate_limit(resp)

            if resp.status_code == 404:
                raise GitHubError(
                    code="TREE_NOT_FOUND",
                    message=f"Git tree for commit '{commit_sha}' was not found.",
                    status_code=404,
                )
            if resp.status_code == 409:
                raise EmptyRepoError(f"Git tree for commit '{commit_sha}' is empty.")
            if resp.status_code != 200:
                raise GitHubError(
                    code="GITHUB_API_ERROR",
                    message=f"Failed to fetch Git tree ({resp.status_code}): {resp.text}",
                    status_code=resp.status_code,
                    retryable=resp.status_code >= 500,
                )

            data = resp.json()
            tree = data.get("tree", [])
            truncated = bool(data.get("truncated", False))
            return tree, truncated

    async def get_blob_content(self, owner: str, repo: str, blob_sha: str) -> str:
        """Fetches blob content via GET /repos/{owner}/{repo}/git/blobs/{sha}.

        Decodes base64 payload into utf-8 string. Never executes code!
        """
        url = f"{self.BASE_URL}/repos/{owner}/{repo}/git/blobs/{blob_sha}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(url, headers=self.headers)
            self._check_rate_limit(resp)

            if resp.status_code != 200:
                raise GitHubError(
                    code="BLOB_FETCH_FAILED",
                    message=f"Failed to fetch blob '{blob_sha}' ({resp.status_code})",
                    status_code=resp.status_code,
                )

            data = resp.json()
            encoding = data.get("encoding", "utf-8")
            raw_content = data.get("content", "")

            if encoding == "base64":
                try:
                    decoded_bytes = base64.b64decode(raw_content)
                    return decoded_bytes.decode("utf-8", errors="replace")
                except Exception as e:
                    return f"[Error decoding file content: {e}]"

            return raw_content

    async def connect_repository(
        self,
        repo_url: str,
        branch: Optional[str] = None,
        max_files: Optional[int] = None,
        max_bytes: Optional[int] = None,
    ) -> Tuple[RepoConnectResult, List[Dict[str, Any]]]:
        """End-to-end repository connection routine for Phase 2:

        1. Validates and parses repository URL
        2. Retrieves public repo metadata (default branch, html_url)
        3. Resolves exact full HEAD commit SHA
        4. Fetches recursive Git tree at that SHA
        5. Computes filtered analyzable files and honest scope summary
        6. Returns (RepoConnectResult, analyzable_files)
        """
        settings = get_settings()
        max_files = max_files or settings.MAX_FILES_ANALYZED
        max_bytes = max_bytes or settings.MAX_FILE_BYTES

        owner, repo = parse_github_url(repo_url)

        # 1. Fetch metadata
        meta = await self.get_repo_metadata(owner, repo)
        resolved_branch = branch or meta.get("default_branch") or "main"
        html_url = meta.get("html_url") or f"https://github.com/{owner}/{repo}"

        # 2. Resolve HEAD SHA
        head_sha = await self.get_branch_head_sha(owner, repo, resolved_branch)

        # 3. Fetch tree
        tree_entries, truncated = await self.get_tree(owner, repo, head_sha)

        # 4. Filter and report scope
        analyzable_entries, scope = filter_tree_files(
            tree_entries=tree_entries,
            max_files_analyzed=max_files,
            max_file_bytes=max_bytes,
            truncated=truncated,
        )

        # In Phase 2 (read-only repository connection), webhook is not yet registered (deferred to Phase 3)
        webhook_status = WebhookStatus.NONE

        result = RepoConnectResult(
            owner=owner,
            name=repo,
            html_url=html_url,
            default_branch=resolved_branch,
            head_sha=head_sha,
            scope=scope,
            webhook_status=webhook_status,
        )

        return result, analyzable_entries

    async def compare_commits(self, owner: str, repo: str, base_sha: str, head_sha: str) -> Dict[str, Any]:
        """Compares two commits via GET /repos/{owner}/{repo}/compare/{base}...{head}.

        Returns changed files, status, and commit details.
        """
        url = f"{self.BASE_URL}/repos/{owner}/{repo}/compare/{base_sha}...{head_sha}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(url, headers=self.headers)
            self._check_rate_limit(resp)

            if resp.status_code != 200:
                raise GitHubError(
                    code="COMPARE_FAILED",
                    message=f"Failed to compare commits {base_sha[:8]}...{head_sha[:8]} ({resp.status_code})",
                    status_code=resp.status_code,
                    retryable=resp.status_code >= 500,
                )

            data = resp.json()
            files_changed = [f.get("filename") for f in data.get("files", []) if f.get("filename")]
            return {
                "status": data.get("status"),
                "ahead_by": data.get("ahead_by", 0),
                "behind_by": data.get("behind_by", 0),
                "total_commits": data.get("total_commits", 0),
                "files_changed": files_changed,
                "raw_files": data.get("files", []),
            }
