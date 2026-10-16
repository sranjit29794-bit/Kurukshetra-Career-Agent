import pytest
from fastapi.testclient import TestClient
import httpx

from backend.app.github.client import (
    EmptyRepoError,
    GitHubClient,
    GitHubError,
    InvalidRepoUrlError,
    RateLimitError,
    RepoNotFoundError,
    parse_github_url,
)
from backend.app.github.files import categorize_file, filter_tree_files, is_secret_like
from backend.app.main import app

client = TestClient(app)


# ==============================================================================
# URL Parsing Tests (Docs/BRAIN.md §14)
# ==============================================================================

def test_parse_github_url_valid_variations():
    cases = [
        ("https://github.com/rohan-dev/student-api", ("rohan-dev", "student-api")),
        ("https://github.com/rohan-dev/student-api.git", ("rohan-dev", "student-api")),
        ("https://github.com/rohan-dev/student-api/", ("rohan-dev", "student-api")),
        ("http://github.com/octocat/Hello-World", ("octocat", "Hello-World")),
        ("github.com/tiangolo/fastapi", ("tiangolo", "fastapi")),
        ("pallets/flask", ("pallets", "flask")),
        ("psf/requests.git", ("psf", "requests")),
    ]
    for raw_url, expected in cases:
        owner, repo = parse_github_url(raw_url)
        assert (owner, repo) == expected, f"Failed parsing {raw_url}"


def test_parse_github_url_invalid():
    invalid_cases = [
        "",
        "   ",
        "not_a_url",
        "https://gitlab.com/owner/repo",
        "https://github.com/",
        "just_one_word",
    ]
    for bad_url in invalid_cases:
        with pytest.raises(InvalidRepoUrlError):
            parse_github_url(bad_url)


# ==============================================================================
# Scope & File Filtering Tests (Docs/BRAIN.md §11)
# ==============================================================================

def test_secret_detection_allows_example_blocks_real():
    assert is_secret_like(".env.example") is False
    assert is_secret_like(".env.sample") is False
    assert is_secret_like(".env") is True
    assert is_secret_like(".env.local") is True
    assert is_secret_like("config/credentials.json") is True
    assert is_secret_like("keys/id_rsa") is True
    assert is_secret_like("server.key") is True
    assert is_secret_like("app/main.py") is False


def test_categorize_file_rules():
    # Excluded directories
    analyzable, reason = categorize_file("node_modules/axios/index.js", 500)
    assert not analyzable and reason == "excluded_dir"

    analyzable, reason = categorize_file(".venv/lib/python3.11/site.py", 500)
    assert not analyzable and reason == "excluded_dir"

    analyzable, reason = categorize_file("app/__pycache__/main.cpython-311.pyc", 500)
    assert not analyzable and reason == "excluded_dir"

    # Secret-like
    analyzable, reason = categorize_file(".env", 120)
    assert not analyzable and reason == "secret_like"

    # Binary
    analyzable, reason = categorize_file("assets/logo.png", 5000)
    assert not analyzable and reason == "binary"

    analyzable, reason = categorize_file("data/devproof.db", 5000)
    assert not analyzable and reason == "binary"

    # Lockfiles
    analyzable, reason = categorize_file("package-lock.json", 15000)
    assert not analyzable and reason == "lockfile"

    # Size exceeded (> 100,000 bytes)
    analyzable, reason = categorize_file("data/large_dataset.py", 200000)
    assert not analyzable and reason == "size_exceeded"

    # Unsupported extension
    analyzable, reason = categorize_file("src/component.tsx", 1500)
    assert not analyzable and reason == "unsupported_ext"

    # Supported Python files & configs
    analyzable, reason = categorize_file("app/main.py", 2500)
    assert analyzable and reason is None

    analyzable, reason = categorize_file("Dockerfile", 500)
    assert analyzable and reason is None

    analyzable, reason = categorize_file("pyproject.toml", 800)
    assert analyzable and reason is None

    analyzable, reason = categorize_file("requirements.txt", 400)
    assert analyzable and reason is None

    analyzable, reason = categorize_file(".env.example", 300)
    assert analyzable and reason is None


def test_filter_tree_files_scope_and_caps():
    mock_tree = [
        {"type": "blob", "path": "app/main.py", "size": 1200},
        {"type": "blob", "path": "app/db.py", "size": 800},
        {"type": "blob", "path": "tests/test_api.py", "size": 950},
        {"type": "blob", "path": "node_modules/lib.js", "size": 300},
        {"type": "blob", "path": ".env", "size": 100},
        {"type": "blob", "path": "image.png", "size": 4000},
        {"type": "blob", "path": "README.md", "size": 1500},
        {"type": "tree", "path": "app"},  # Non-blob directory entry
    ]

    analyzed, scope = filter_tree_files(mock_tree, max_files_analyzed=10)
    assert len(analyzed) == 4  # main.py, db.py, test_api.py, README.md
    assert scope.analyzed == 4
    assert scope.skipped == 3  # node_modules, .env, image.png
    assert scope.skipped_reasons.get("excluded_dir") == 1
    assert scope.skipped_reasons.get("secret_like") == 1
    assert scope.skipped_reasons.get("binary") == 1
    assert scope.truncated is False


def test_filter_tree_files_max_cap_truncation():
    # Generate 160 analyzable python files to exceed default cap of 150
    mock_tree = [
        {"type": "blob", "path": f"module_{i}.py", "size": 100}
        for i in range(160)
    ]
    analyzed, scope = filter_tree_files(mock_tree, max_files_analyzed=150)
    assert len(analyzed) == 150
    assert scope.analyzed == 150
    assert scope.skipped == 10
    assert scope.skipped_reasons["max_limit_exceeded"] == 10
    assert scope.truncated is True


# ==============================================================================
# Router / Endpoint Tests with Mocked GitHub REST API
# ==============================================================================

@pytest.mark.asyncio
async def test_connect_repository_success(monkeypatch):
    # Mock GitHubClient methods to avoid network requests in unit test
    async def mock_get_repo_metadata(self, owner, repo):
        return {
            "owner": {"login": owner},
            "name": repo,
            "default_branch": "main",
            "html_url": f"https://github.com/{owner}/{repo}",
        }

    async def mock_get_branch_head_sha(self, owner, repo, branch):
        return "a1b2c3d4e5f67890123456789abcdef012345678"

    async def mock_get_tree(self, owner, repo, sha):
        return [
            {"type": "blob", "path": "app/main.py", "size": 1500},
            {"type": "blob", "path": "requirements.txt", "size": 200},
            {"type": "blob", "path": "package.json", "size": 400},
            {"type": "blob", "path": ".env", "size": 80},
        ], False

    monkeypatch.setattr(GitHubClient, "get_repo_metadata", mock_get_repo_metadata)
    monkeypatch.setattr(GitHubClient, "get_branch_head_sha", mock_get_branch_head_sha)
    monkeypatch.setattr(GitHubClient, "get_tree", mock_get_tree)

    response = client.post("/api/repos/connect", json={"repo_url": "https://github.com/test-owner/test-api"})
    assert response.status_code == 200
    data = response.json()

    assert data["owner"] == "test-owner"
    assert data["name"] == "test-api"
    assert data["default_branch"] == "main"
    assert data["head_sha"] == "a1b2c3d4e5f67890123456789abcdef012345678"
    assert data["scope"]["analyzed"] == 2  # app/main.py + requirements.txt
    assert data["scope"]["skipped"] == 2   # package.json + .env
    assert data["webhook_status"] in ["none", "manual"]


def test_connect_repository_invalid_url():
    response = client.post("/api/repos/connect", json={"repo_url": "invalid://not-github"})
    assert response.status_code == 400
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "INVALID_REPO_URL"


@pytest.mark.asyncio
async def test_connect_repository_404_repo_not_found(monkeypatch):
    async def mock_get_repo_metadata(self, owner, repo):
        raise RepoNotFoundError(f"Repository '{owner}/{repo}' not found or is private.")

    monkeypatch.setattr(GitHubClient, "get_repo_metadata", mock_get_repo_metadata)

    response = client.post("/api/repos/connect", json={"repo_url": "https://github.com/ghost/hidden-repo"})
    assert response.status_code == 404
    data = response.json()
    assert data["error"]["code"] == "REPO_NOT_FOUND_OR_PRIVATE"


@pytest.mark.asyncio
async def test_connect_repository_rate_limit(monkeypatch):
    async def mock_get_repo_metadata(self, owner, repo):
        raise RateLimitError("GitHub API rate limit exceeded", reset_epoch=1760636400)

    monkeypatch.setattr(GitHubClient, "get_repo_metadata", mock_get_repo_metadata)

    response = client.post("/api/repos/connect", json={"repo_url": "https://github.com/busy/api"})
    assert response.status_code == 429
    data = response.json()
    assert data["error"]["code"] == "GITHUB_RATE_LIMITED"
    assert data["error"]["retryable"] is True
    assert data["error"]["reset_epoch"] == 1760636400


def test_honest_webhook_status_in_phase_2(monkeypatch):
    # Verify that in Phase 2, connect_repository produces honest WebhookStatus.NONE
    async def mock_get_repo_metadata(self, owner, repo):
        return {
            "owner": {"login": owner},
            "name": repo,
            "default_branch": "main",
            "html_url": f"https://github.com/{owner}/{repo}",
        }

    async def mock_get_branch_head_sha(self, owner, repo, branch):
        return "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1"

    async def mock_get_tree(self, owner, repo, sha):
        return [{"type": "blob", "path": "main.py", "size": 100}], False

    monkeypatch.setattr(GitHubClient, "get_repo_metadata", mock_get_repo_metadata)
    monkeypatch.setattr(GitHubClient, "get_branch_head_sha", mock_get_branch_head_sha)
    monkeypatch.setattr(GitHubClient, "get_tree", mock_get_tree)

    response = client.post("/api/repos/connect", json={"repo_url": "https://github.com/honest/repo"})
    assert response.status_code == 200
    data = response.json()
    assert data["webhook_status"] == "none"  # Invariant: Phase 2 does not claim registered webhooks


@pytest.mark.asyncio
async def test_connect_repository_empty_repo(monkeypatch):
    async def mock_get_repo_metadata(self, owner, repo):
        raise EmptyRepoError("Repository is empty")

    monkeypatch.setattr(GitHubClient, "get_repo_metadata", mock_get_repo_metadata)

    response = client.post("/api/repos/connect", json={"repo_url": "https://github.com/fresh/empty-repo"})
    assert response.status_code == 422
    data = response.json()
    assert data["error"]["code"] == "EMPTY_REPOSITORY"


# ==============================================================================
# Real Smoke Test (Real Network to Public Repo - Skipped if Offline)
# ==============================================================================

@pytest.mark.asyncio
async def test_real_public_github_smoke_test():
    """Real smoke test fetching public repository info over the network.

    Clearly separated from unit tests; skipped if machine lacks internet or is rate-limited.
    """
    client = GitHubClient(timeout=10.0)
    try:
        # Check connectivity against public repository octocat/Hello-World
        meta = await client.get_repo_metadata("octocat", "Hello-World")
        assert meta["name"] == "Hello-World"
        assert meta["default_branch"] in ["master", "main"]

        sha = await client.get_branch_head_sha("octocat", "Hello-World", meta["default_branch"])
        assert len(sha) == 40

        tree, _ = await client.get_tree("octocat", "Hello-World", sha)
        assert len(tree) > 0
    except (httpx.ConnectError, httpx.TimeoutException) as net_err:
        pytest.skip(f"Live network access unavailable: {net_err}")
    except RateLimitError:
        pytest.skip("GitHub unauthenticated rate limit reached; unit tests remain 100% green.")
