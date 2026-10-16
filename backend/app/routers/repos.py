"""Repository connection and management router.

Reference: docs/PLAN-5H.md (§4 BE lane).
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/repos", tags=["Repositories"])
