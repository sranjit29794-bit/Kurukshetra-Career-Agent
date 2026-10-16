from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.config import get_settings
from backend.app.db import init_db
from backend.app.routers.dev import router as dev_router
from backend.app.routers.health import router as health_router
from backend.app.routers.repos import router as repos_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Startup: Initialize database tables safely
    init_db()
    yield
    # Shutdown logic (e.g. clean up background tasks when implemented in later phases)


app = FastAPI(
    title="DevProof API",
    description="Backend API for DevProof — Live, evidence-backed career assessment for developers",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS for local development origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.exceptions import RequestValidationError


# Consistent error handling shape: {error: {code, message, retryable}}
@app.exception_handler(StarletteHTTPException)
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": f"HTTP_{exc.status_code}",
                "message": str(exc.detail),
                "retryable": exc.status_code in (408, 429, 502, 503, 504),
            }
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": str(exc),
                "retryable": False,
            }
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected server error occurred.",
                "retryable": False,
            }
        },
    )


# Mount routers
app.include_router(health_router)
app.include_router(dev_router)
app.include_router(repos_router)


@app.get("/")
async def root():
    return {
        "name": "DevProof API",
        "version": "0.1.0",
        "docs_url": "/docs",
        "health_url": "/api/health",
    }
