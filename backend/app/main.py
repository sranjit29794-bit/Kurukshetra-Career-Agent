"""FastAPI application entry point for DevProof.

Reference: docs/BRAIN.md (§6, §7.1, §13) and docs/PLAN-5H.md (§4, R0).
"""

from __future__ import annotations

import importlib
import pkgutil
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import backend.app.routers as routers_pkg
from backend.app.agents.job_ingest import JobIngestError
from backend.app.config import settings
from backend.app.db import init_db
from backend.app.github.client import GitHubAPIError
from backend.app.schemas import ErrorDetail, ErrorEnvelope


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager to initialize DB and manage background tasks."""
    # Initialize SQLite database schemas when running local SQLite
    if settings.DATABASE_URL.startswith("sqlite"):
        init_db()
    yield
    # Teardown logic (e.g. background watcher cancellation) will live here


app = FastAPI(
    title="DevProof API",
    description="Evidence-backed career assessment & real-time repository reassessment engine",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def auto_discover_routers(application: FastAPI) -> list[str]:
    """Auto-discover and mount every APIRouter exposed in backend.app.routers.

    Enables lanes to add routes by creating router modules without editing main.py.
    """
    discovered: list[str] = []
    for _, module_name, _ in pkgutil.iter_modules(routers_pkg.__path__):
        module = importlib.import_module(f"backend.app.routers.{module_name}")
        router = getattr(module, "router", None)
        if isinstance(router, APIRouter):
            application.include_router(router)
            discovered.append(module_name)
    return discovered


# Auto-mount all discovered router modules
discovered_routers = auto_discover_routers(app)


@app.exception_handler(JobIngestError)
async def job_ingest_error_handler(
    request: Request, exc: JobIngestError
) -> JSONResponse:
    """Handle normalized Job Ingest errors with standard ErrorEnvelope."""
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict(),
    )


@app.exception_handler(GitHubAPIError)
async def github_api_error_handler(
    request: Request, exc: GitHubAPIError
) -> JSONResponse:
    """Handle normalized GitHub API errors with standard ErrorEnvelope."""
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict(),
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Fallback exception handler ensuring consistent ErrorEnvelope format per BRAIN §13."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorEnvelope(
            error=ErrorDetail(
                code="INTERNAL_SERVER_ERROR",
                message=str(exc) or "An unexpected server error occurred",
                retryable=True,
            )
        ).model_dump(),
    )
