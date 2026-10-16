"""Job ingestion and requirements extraction router.

Reference: docs/PLAN-5H.md (§4 IN lane, §5 R0).
"""

from fastapi import APIRouter

from backend.app.schemas import ClaimsMatrix

router = APIRouter(prefix="/api/jobs", tags=["Jobs"])


@router.get("/{id}/claims-matrix", response_model=ClaimsMatrix)
async def get_job_claims_matrix(id: str) -> ClaimsMatrix:
    """Return Claims Matrix comparing resume claims against repo assessments.

    Contract stub for Phase R0; implementation lands in Phase IN-2.
    """
    raise NotImplementedError("Contract stub; implemented in Phase IN-2")
