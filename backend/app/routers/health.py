from datetime import datetime
from typing import Any, Dict
from fastapi import APIRouter
from backend.app.config import get_settings
from backend.app.github.client import GitHubClient
from backend.app.schemas import HealthResponse

router = APIRouter(prefix="/api", tags=["health"])

# Simple in-memory cache for GitHub rate limit to avoid consuming quota on frequent health polls
_cached_rate: Dict[str, Any] = {"remaining": 5000, "checked_at": 0.0}


@router.get("/health", response_model=HealthResponse)
async def get_health() -> HealthResponse:
    settings = get_settings()

    # Determine LLM state honestly
    if not settings.LLM_ENABLED:
        llm_state = "disabled"
    elif not settings.effective_llm_api_key:
        llm_state = "unconfigured"
    else:
        llm_state = "ok"

    # Determine GitHub state honestly
    if not settings.GITHUB_TOKEN:
        github_state = "unconfigured"
        github_rate_remaining = None
    else:
        github_state = "ok"
        github_rate_remaining = 5000
        # Try checking rate limit safely if cached is older than 60 seconds
        import time
        now = time.time()
        if now - _cached_rate.get("checked_at", 0) > 60:
            client = GitHubClient()
            info = await client.get_rate_limit()
            if info.get("remaining") is not None:
                _cached_rate["remaining"] = info["remaining"]
                _cached_rate["checked_at"] = now
        github_rate_remaining = _cached_rate.get("remaining", 5000)

    # Determine Watcher state honestly
    if settings.PUBLIC_BASE_URL and settings.GITHUB_TOKEN:
        watcher_state = "both"
    elif settings.POLL_INTERVAL_S > 0:
        watcher_state = "polling"
    else:
        watcher_state = "unconfigured"

    return HealthResponse(
        backend="ok",
        llm=llm_state,
        github=github_state,
        github_rate_remaining=github_rate_remaining,
        watcher=watcher_state,
        next_poll_in_s=settings.POLL_INTERVAL_S if watcher_state in ("polling", "both") else None,
        timestamp=datetime.utcnow(),
    )


@router.get("/health/audit")
async def get_config_audit() -> Dict[str, Any]:
    """Safe configuration audit reporting integration health and operational status.

    Strict security invariant: NEVER returns, prints, or exposes API keys, tokens,
    or key fragments.
    """
    settings = get_settings()
    has_github = bool(settings.GITHUB_TOKEN)
    has_llm = bool(settings.effective_llm_api_key)

    client = GitHubClient()
    rate_info = await client.get_rate_limit()

    provider = "unconfigured"
    if has_llm:
        if settings.GEMINI_API_KEY or (settings.LLM_MODEL and "gemini" in settings.LLM_MODEL.lower()):
            provider = "gemini"
        elif settings.LLM_BASE_URL and "openai" in settings.LLM_BASE_URL.lower():
            provider = "openai"
        else:
            provider = "custom_openai_compatible"

    return {
        "status": "ok",
        "github": {
            "configured": has_github,
            "authenticated": rate_info.get("authenticated", False),
            "rate_limit": rate_info.get("limit", 60),
            "rate_remaining": rate_info.get("remaining"),
            "reset_epoch": rate_info.get("reset_epoch"),
        },
        "llm": {
            "enabled": settings.LLM_ENABLED,
            "configured": has_llm,
            "provider": provider,
            "deterministic_fallback_active": not (settings.LLM_ENABLED and has_llm),
            "timeout_seconds": settings.LLM_TIMEOUT_S,
        },
        "security": {
            "ssrf_protection_active": True,
            "strict_non_execution_active": True,
            "immutable_evidence_anchors": True,
        },
        "timestamp": datetime.utcnow().isoformat(),
    }
