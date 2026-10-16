"""Impact analysis mapping git commit file deltas to affected taxonomy skills.

Reference: docs/BRAIN.md (§6.1, §10.4) and docs/PLAN-5H.md (Phase BE-2).

Hard Invariants:
1. README-only or docs-only commits produce: "docs only: no skill change" and no reassessment.
2. Changes to tests trigger testing and python_lang reassessment.
3. Changes to database/SQL files trigger sql_database and python_lang reassessment.
4. Changes to Dockerfile/deployment configs trigger deployment reassessment.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ImpactResult:
    """Result of analyzing changed files in a commit."""

    is_docs_only: bool
    affected_keys: set[str] = field(default_factory=set)
    reason: str = ""
    changed_files: list[str] = field(default_factory=list)


def is_doc_file(path: str) -> bool:
    """Check if a file path is purely documentation or markdown."""
    lower = path.lower()
    if lower.startswith("docs/") or "/docs/" in lower:
        return True
    if lower.endswith((".md", ".rst", ".txt")):
        # requirements.txt is a dependency manifest, not doc
        return "requirements" not in lower
    return False


def compute_impact(changed_files: list[str]) -> ImpactResult:
    """Map changed files to affected taxonomy skill keys."""
    if not changed_files:
        return ImpactResult(
            is_docs_only=True,
            affected_keys=set(),
            reason="No changed files detected",
            changed_files=[],
        )

    # 1. Check if all changed files are documentation
    if all(is_doc_file(f) for f in changed_files):
        return ImpactResult(
            is_docs_only=True,
            affected_keys=set(),
            reason="docs only: no skill change",
            changed_files=changed_files,
        )

    # 2. Map file patterns to taxonomy keys
    affected: set[str] = set()

    for file_path in changed_files:
        lower = file_path.lower()

        # SQL / Database
        if (
            lower.endswith(".sql")
            or "migrations/" in lower
            or "alembic/" in lower
            or "db.py" in lower
            or "database.py" in lower
            or "models.py" in lower
        ):
            affected.add("sql_database")

        # Testing
        if (
            lower.startswith("tests/")
            or "/tests/" in lower
            or "test_" in lower
            or lower.endswith("_test.py")
        ):
            affected.add("testing")

        # Deployment
        if (
            "dockerfile" in lower
            or "docker-compose" in lower
            or lower.endswith("render.yaml")
            or "procfile" in lower
            or lower.endswith(".tf")
        ):
            affected.add("deployment")

        # CI/CD
        if ".github/workflows/" in lower or "ci.yml" in lower or "test.yml" in lower:
            affected.add("ci_cd")
            affected.add("testing")

        # REST API / Web Framework
        if (
            "router" in lower
            or "api/" in lower
            or "endpoints/" in lower
            or "main.py" in lower
            or "app.py" in lower
            or "views.py" in lower
        ):
            affected.add("rest_api")

        # General Python
        if lower.endswith(".py"):
            affected.add("python_lang")

    # If non-doc files changed but matched no specific taxonomy rule,
    # mark python_lang by default if Python or all if unmapped
    if not affected:
        affected.add("generic_keyword")

    return ImpactResult(
        is_docs_only=False,
        affected_keys=affected,
        reason=f"Changed files affect {len(affected)} taxonomy skill{'s' if len(affected) != 1 else ''}",
        changed_files=changed_files,
    )
