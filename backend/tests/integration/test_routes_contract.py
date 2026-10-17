"""Test Step 2: Route and schema contract verification.

Verifies that all frontend API paths in frontend/src/lib/api.ts
map to real backend endpoints declared in FastAPI app.routes / OpenAPI schema.
"""

from __future__ import annotations

import json
from pathlib import Path

from backend.app.main import app

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent


def test_frontend_routes_match_openapi() -> None:
    """Export openapi.json and assert all frontend API routes exist in backend schema."""
    openapi_schema = app.openapi()
    openapi_path = REPO_ROOT / "frontend" / "src" / "openapi.json"
    openapi_path.write_text(json.dumps(openapi_schema, indent=2), encoding="utf-8")

    paths = openapi_schema.get("paths", {})

    expected_routes = [
        ("/api/health", "get"),
        ("/api/jobs/extract", "post"),
        ("/api/jobs", "post"),
        ("/api/jobs", "get"),
        ("/api/jobs/{id}/claims-matrix", "get"),
        ("/api/jobs/{id}", "delete"),
        ("/api/resume/parse", "post"),
        ("/api/repos/connect", "post"),
        ("/api/tracks", "get"),
        ("/api/tracks", "post"),
        ("/api/tracks/{id}", "get"),
        ("/api/tracks/{id}", "delete"),
        ("/api/tracks/user/data", "delete"),
        ("/api/tracks/{id}/check-now", "post"),
        ("/api/tracks/{id}/diff", "get"),
        ("/api/evidence/{id}/file", "get"),
        ("/api/events/stream", "get"),
        ("/api/github/users/{u}/repos", "get"),
    ]

    missing = []
    for path, method in expected_routes:
        if path not in paths:
            missing.append(f"{method.upper()} {path} (path not found in openapi)")
        elif method not in paths[path]:
            missing.append(f"{method.upper()} {path} (method not found in path)")

    assert not missing, "Backend routes missing for frontend calls:\n" + "\n".join(
        missing
    )
