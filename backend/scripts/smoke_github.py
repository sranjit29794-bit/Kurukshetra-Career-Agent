"""Smoke test script for validating GitHub API connectivity and token rate limits.

Reference: docs/BRAIN.md (§7.3, §14).
"""

import sys

import httpx

from backend.app.config import settings


def run_smoke_github() -> bool:
    """Check GitHub rate limits and API access, printing OK or FAIL."""
    print("--- DevProof GitHub Smoke Test ---")
    has_token = bool(settings.GITHUB_TOKEN)
    print(f"Token Configured: {has_token}")

    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "DevProof-SmokeTest",
    }
    if has_token:
        headers["Authorization"] = f"Bearer {settings.GITHUB_TOKEN}"

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get("https://api.github.com/rate_limit", headers=headers)

        if resp.status_code == 200:
            data = resp.json()
            core_rate = data.get("resources", {}).get("core", {})
            remaining = core_rate.get("remaining")
            limit = core_rate.get("limit")
            print(f"[GitHub] OK: Connected (Rate limit: {remaining}/{limit})")
            return True
        else:
            print(
                f"[GitHub] FAIL: GitHub returned HTTP {resp.status_code}: {resp.text}"
            )
            return False
    except (httpx.HTTPError, OSError) as exc:
        print(f"[GitHub] FAIL: Network connection failed: {exc}")
        return False


if __name__ == "__main__":
    success = run_smoke_github()
    sys.exit(0 if success else 1)
