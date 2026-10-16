"""Repository file filter and scope reporting.

Reference: docs/BRAIN.md (§11, §14, §18) and docs/PLAN-5H.md (Phase BE-1).
"""

from __future__ import annotations

from pathlib import PurePosixPath
from typing import Any

from backend.app.config import settings
from backend.app.schemas import ScopeInfo

# Allowed extensions and specific filenames for Python backend analysis
SUPPORTED_EXTENSIONS = {
    ".py",
    ".toml",
    ".cfg",
    ".txt",
    ".yml",
    ".yaml",
    ".sql",
    ".md",
}

SUPPORTED_FILENAMES = {
    "dockerfile",
    "procfile",
    ".env.example",
}

# Directories to skip entirely
IGNORED_DIRECTORIES = {
    ".git",
    "node_modules",
    "venv",
    ".venv",
    "env",
    "__pycache__",
    "dist",
    "build",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "vendor",
}

# Lockfile names
LOCKFILES = {
    "package-lock.json",
    "poetry.lock",
    "pipfile.lock",
    "pnpm-lock.yaml",
    "yarn.lock",
    "cargo.lock",
}

# Known binary extensions
BINARY_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".ico",
    ".pdf",
    ".zip",
    ".tar",
    ".gz",
    ".pyc",
    ".exe",
    ".dll",
    ".so",
    ".dylib",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".db",
    ".sqlite",
    ".sqlite3",
}


def is_secret_like(path_str: str) -> bool:
    """Check if file matches known secret/credential patterns.

    Secret-like files are NEVER fetched or cached.
    """
    path = PurePosixPath(path_str)
    name_lower = path.name.lower()

    if name_lower == ".env.example":
        return False

    if name_lower.startswith(".env"):
        return True

    # Private keys, certificates, credentials
    if any(
        name_lower.endswith(ext)
        for ext in (".pem", ".key", ".p12", ".pfx", ".crt", ".der")
    ):
        return True

    if any(
        name_lower.startswith(prefix)
        for prefix in ("id_rsa", "id_ed25519", "id_dsa", "id_ecdsa")
    ):
        return True

    return name_lower.startswith(("credentials", "secrets"))


def filter_repo_tree(
    tree_entries: list[dict[str, Any]],
    max_files: int | None = None,
    max_bytes: int | None = None,
    github_truncated: bool = False,
) -> tuple[list[dict[str, Any]], ScopeInfo]:
    """Filter raw git tree entries down to analyzable files and compute ScopeInfo.

    Args:
        tree_entries: Raw git tree objects from GitHub GET /git/trees/{sha}?recursive=1
        max_files: Maximum number of files to analyze before truncating
        max_bytes: Maximum size in bytes per file
        github_truncated: Whether the upstream GitHub tree response had truncated=True

    Returns:
        tuple of (analyzed_entries, ScopeInfo)
    """
    max_f = max_files if max_files is not None else settings.MAX_FILES_ANALYZED
    max_b = max_bytes if max_bytes is not None else settings.MAX_FILE_BYTES

    analyzed_candidates: list[dict[str, Any]] = []
    skipped_reasons: dict[str, int] = {}
    skipped_count = 0

    for entry in tree_entries:
        # Only process blob entries (files), ignore trees/directories
        if entry.get("type") != "blob":
            continue

        raw_path = entry.get("path", "")
        posix_path = PurePosixPath(raw_path)
        parts = posix_path.parts
        file_name_lower = posix_path.name.lower()
        file_ext_lower = posix_path.suffix.lower()
        size = entry.get("size", 0)

        # 1. Directory exclusion check
        if any(part in IGNORED_DIRECTORIES for part in parts[:-1]):
            skipped_reasons["ignored_directory"] = (
                skipped_reasons.get("ignored_directory", 0) + 1
            )
            skipped_count += 1
            continue

        # 2. Secret check (NEVER fetch or cache)
        if is_secret_like(raw_path):
            skipped_reasons["secret_pattern"] = (
                skipped_reasons.get("secret_pattern", 0) + 1
            )
            skipped_count += 1
            continue

        # 3. Lockfile check
        if file_name_lower in LOCKFILES:
            skipped_reasons["lockfile"] = skipped_reasons.get("lockfile", 0) + 1
            skipped_count += 1
            continue

        # 4. Binary check
        if file_ext_lower in BINARY_EXTENSIONS:
            skipped_reasons["binary"] = skipped_reasons.get("binary", 0) + 1
            skipped_count += 1
            continue

        # 5. Extension / filename compatibility check (Python focus)
        is_supported = (
            file_ext_lower in SUPPORTED_EXTENSIONS
            or file_name_lower in SUPPORTED_FILENAMES
            or file_name_lower.startswith("dockerfile")
        )
        if not is_supported:
            skipped_reasons["unsupported_extension"] = (
                skipped_reasons.get("unsupported_extension", 0) + 1
            )
            skipped_count += 1
            continue

        # 6. File size check
        if size > max_b:
            skipped_reasons["oversized"] = skipped_reasons.get("oversized", 0) + 1
            skipped_count += 1
            continue

        # Candidate is analyzable
        analyzed_candidates.append(entry)

    # 7. Apply max_files budget cap
    truncated = github_truncated
    if len(analyzed_candidates) > max_f:
        truncated = True
        analyzed = analyzed_candidates[:max_f]
        over_budget_count = len(analyzed_candidates) - max_f
        skipped_reasons["max_files_exceeded"] = (
            skipped_reasons.get("max_files_exceeded", 0) + over_budget_count
        )
        skipped_count += over_budget_count
    else:
        analyzed = analyzed_candidates

    scope = ScopeInfo(
        analyzed=len(analyzed),
        skipped=skipped_count,
        skipped_reasons=skipped_reasons,
        truncated=truncated,
    )

    return analyzed, scope
