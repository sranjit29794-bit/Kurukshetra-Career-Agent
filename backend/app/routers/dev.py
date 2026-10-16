import json
from pathlib import Path
from typing import Any, Dict
from fastapi import APIRouter, HTTPException

from backend.app.schemas import (
    AgentEvent,
    AnalysisDetail,
    DiffResponse,
    JobDraft,
    RepoConnectResult,
)

router = APIRouter(prefix="/api/dev", tags=["dev"])

FIXTURES_DIR = Path(__file__).resolve().parents[3] / "docs" / "fixtures"


@router.get("/contracts")
async def get_dev_contracts() -> Dict[str, Any]:
    """Returns validated sample contract data from docs/fixtures.

    Useful for frontend verification and contract verification during development.
    Never exposes secrets or environment configurations.
    """
    try:
        job_draft_data = json.loads((FIXTURES_DIR / "job_draft.json").read_text(encoding="utf-8"))
        repo_connect_data = json.loads((FIXTURES_DIR / "repo_connect.json").read_text(encoding="utf-8"))
        assessment_data = json.loads((FIXTURES_DIR / "assessment.json").read_text(encoding="utf-8"))
        diff_data = json.loads((FIXTURES_DIR / "diff.json").read_text(encoding="utf-8"))
        events_data = json.loads((FIXTURES_DIR / "agent_events.json").read_text(encoding="utf-8"))

        # Validate against Pydantic schemas to ensure contract consistency
        validated_job = JobDraft.model_validate(job_draft_data).model_dump(mode="json")
        validated_repo = RepoConnectResult.model_validate(repo_connect_data).model_dump(mode="json")
        validated_assessment = AnalysisDetail.model_validate(assessment_data).model_dump(mode="json")
        validated_diff = DiffResponse.model_validate(diff_data).model_dump(mode="json")
        validated_events = [AgentEvent.model_validate(ev).model_dump(mode="json") for ev in events_data]

        return {
            "contracts_valid": True,
            "job_draft": validated_job,
            "repo_connect": validated_repo,
            "assessment": validated_assessment,
            "diff": validated_diff,
            "agent_events": validated_events,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": {"code": "CONTRACT_LOAD_ERROR", "message": str(e), "retryable": False}},
        )
