"""Resume upload and claims extraction router.

Reference: docs/PLAN-5H.md (§1.2 A1, A3, §4 IN lane).
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/resume", tags=["Resume"])
