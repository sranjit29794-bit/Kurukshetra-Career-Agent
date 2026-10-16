"""Opportunity track router (pairing job and repository).

Reference: docs/PLAN-5H.md (§4 BE lane).
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/tracks", tags=["Tracks"])
