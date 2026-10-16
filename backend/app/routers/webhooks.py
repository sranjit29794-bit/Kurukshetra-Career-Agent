"""GitHub webhook reception and HMAC verification router.

Reference: docs/PLAN-5H.md (§4 BE lane).
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/webhooks", tags=["Webhooks"])
