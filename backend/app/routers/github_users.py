"""GitHub user profile and candidate repositories router.

Reference: docs/PLAN-5H.md (§1.2 A4, §4 BE lane).
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/github/users", tags=["GitHub Users"])
