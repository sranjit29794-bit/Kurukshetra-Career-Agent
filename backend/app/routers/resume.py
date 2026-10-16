"""Resume upload and claims extraction router.

Reference: docs/PLAN-5H.md (§1.2 A1, A3, §4 IN lane, §5 R0).
"""

from fastapi import APIRouter
from pydantic import BaseModel

from backend.app.schemas import ResumeDraft

router = APIRouter(prefix="/api/resume", tags=["Resume"])


class ResumeParseRequest(BaseModel):
    """Resume parse input payload supporting raw text or multipart metadata."""

    text: str | None = None


@router.post("/parse", response_model=ResumeDraft)
async def parse_resume(
    payload: ResumeParseRequest | None = None,
) -> ResumeDraft:
    """Parse candidate resume from multipart file or text string.

    Contract stub for Phase R0; implementation lands in Phase IN-3.
    """
    raise NotImplementedError("Contract stub; implemented in Phase IN-3")
