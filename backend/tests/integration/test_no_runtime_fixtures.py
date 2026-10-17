"""Test Step 1: No fixture or mock data imports in runtime paths.

Invariant:
Fixtures may exist ONLY in tests/ and in an explicit opt-in dev mode module
(frontend/src/lib/devFixtures.ts, active only when VITE_USE_FIXTURES=1).
Any other file under frontend/src or backend/app importing from docs/fixtures
must fail this test.
"""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent


def test_no_docs_fixtures_imports_in_runtime_paths() -> None:
    """Ensure no runtime file under frontend/src or backend/app imports from docs/fixtures."""
    frontend_src = REPO_ROOT / "frontend" / "src"
    backend_app = REPO_ROOT / "backend" / "app"

    # Authorized dev-mode module only
    authorized_dev_modules = {
        (frontend_src / "lib" / "devFixtures.ts").resolve(),
    }

    violating_files: list[str] = []

    # 1. Check frontend/src
    for path in frontend_src.rglob("*"):
        if not path.is_file() or path.resolve() in authorized_dev_modules:
            continue
        if path.suffix not in (".ts", ".tsx", ".js", ".jsx"):
            continue

        content = path.read_text(encoding="utf-8", errors="ignore")
        # Check for import ... from '...docs/fixtures/...'
        if re.search(r"from\s+['\"][^'\"]*docs/fixtures", content) or re.search(
            r"import\s*\([^)]*docs/fixtures", content
        ):
            violating_files.append(str(path.relative_to(REPO_ROOT)))

    # 2. Check backend/app
    for path in backend_app.rglob("*.py"):
        if not path.is_file():
            continue
        content = path.read_text(encoding="utf-8", errors="ignore")
        if re.search(r"docs/fixtures", content) and "docs/fixtures" in [
            line
            for line in content.splitlines()
            if not line.strip().startswith(('"""', "'''", "#"))
        ]:
            violating_files.append(str(path.relative_to(REPO_ROOT)))

    assert not violating_files, (
        "Found unauthorized imports from docs/fixtures in runtime files:\n"
        + "\n".join(f"  - {f}" for f in violating_files)
    )
