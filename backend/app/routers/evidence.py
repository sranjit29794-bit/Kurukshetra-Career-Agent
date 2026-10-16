"""Evidence file retrieval router.

Reference: docs/PLAN-5H.md (§4 BE lane).
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/evidence", tags=["Evidence"])
