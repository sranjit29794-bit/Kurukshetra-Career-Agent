"""Job ingestion and requirements extraction router.

Reference: docs/PLAN-5H.md (§4 IN lane).
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/jobs", tags=["Jobs"])
