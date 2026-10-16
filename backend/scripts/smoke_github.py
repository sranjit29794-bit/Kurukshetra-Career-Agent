"""Smoke test script for validating GitHub API connectivity, rate limits, and public repo access.

Reference: docs/BRAIN.md (§7.3, §14) and docs/PLAN-5H.md (§2, R0).
"""

from __future__ import annotations

import sys
from pathlib import Path

# Add project root to sys.path to allow running directly from any directory
project_root = Path(__file__).resolve().parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

import httpx

from backend.app.config import Settings

# 1. Load backend/.env explicitly by path relative to this script file
backend_env_path = Path(__file__).resolve().parent.parent / ".env"
settings = (
    Settings(_env_file=str(backend_env_path))
    if backend_env_path.exists()
    else Settings()
)


def run_smoke_github(repo_target: str) -> bool:
    """Check GitHub rate limits and verify access to an owner/name public repository."""
    print("--- DevProof GitHub Smoke Test ---")

    # 2. Print Token Configured: True/False and never print the token
    has_token = bool(settings.GITHUB_TOKEN and settings.GITHUB_TOKEN.strip())
    print(f"Token Configured: {has_token}")

    # 4. Require owner/name and reject a bare name
    if (
        not repo_target
        or "/" not in repo_target
        or len(repo_target.split("/")) != 2
        or not repo_target.split("/")[0].strip()
        or not repo_target.split("/")[1].strip()
    ):
        print(
            f"[GitHub] FAIL: Target '{repo_target}' is invalid. An explicit 'owner/name' format is required (bare repo names without an owner are rejected)."
        )
        return False

    repo_target = repo_target.strip()

    # 3. Send the token as an Authorization header
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "DevProof-SmokeTest",
    }
    if has_token:
        headers["Authorization"] = f"Bearer {settings.GITHUB_TOKEN.strip()}"

    try:
        with httpx.Client(timeout=10.0) as client:
            # 1. Check rate limits
            rate_resp = client.get("https://api.github.com/rate_limit", headers=headers)
            if rate_resp.status_code != 200:
                print(
                    f"[GitHub] FAIL: Rate limit check returned HTTP {rate_resp.status_code}: {rate_resp.text}"
                )
                return False

            rate_data = rate_resp.json()
            core_rate = rate_data.get("resources", {}).get("core", {})
            remaining = core_rate.get("remaining")
            limit = core_rate.get("limit")
            print(f"[GitHub] OK: Connected (Rate limit: {remaining}/{limit})")

            # 2. Fetch public repository
            print(f"[GitHub] Testing public repo access: {repo_target}...")
            repo_resp = client.get(
                f"https://api.github.com/repos/{repo_target}", headers=headers
            )

            # Re-read rate limit header
            rl_remaining_header = repo_resp.headers.get(
                "x-ratelimit-remaining", str(remaining)
            )

            if repo_resp.status_code == 200:
                repo_data = repo_resp.json()
                full_name = repo_data.get("full_name")
                default_branch = repo_data.get("default_branch")
                print(
                    f"[GitHub] OK: Successfully read public repo '{full_name}' (default branch: {default_branch})"
                )
                print(
                    f"[GitHub] Rate limit remaining after check: {rl_remaining_header}"
                )
                return True
            else:
                print(
                    f"[GitHub] FAIL: Failed to read public repo '{repo_target}': HTTP {repo_resp.status_code} - {repo_resp.text}"
                )
                print(f"[GitHub] Rate limit remaining: {rl_remaining_header}")
                return False

    except (httpx.HTTPError, OSError) as exc:
        print(f"[GitHub] FAIL: Network connection failed: {exc}")
        return False


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(
            "[GitHub] FAIL: Missing repository target argument. Usage: python backend/scripts/smoke_github.py owner/name"
        )
        sys.exit(1)

    target = sys.argv[1]
    success = run_smoke_github(target)
    sys.exit(0 if success else 1)
