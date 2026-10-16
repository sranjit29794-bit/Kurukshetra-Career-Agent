"""Analysis run and assessment results router.

Reference: docs/PLAN-5H.md (§4 BE lane).
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/analyses", tags=["Analyses"])
