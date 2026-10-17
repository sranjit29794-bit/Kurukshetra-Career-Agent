import os
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from backend.app.schemas import Scope

# Supported extensions and filenames for Python backend analysis (docs/BRAIN.md §11)
SUPPORTED_EXTENSIONS: Set[str] = {
    ".py",
    ".toml",
    ".cfg",
    ".txt",
    ".yml",
    ".yaml",
    ".sql",
    ".md",
}

# Specific filenames that are analyzed even if extension is uncommon
SUPPORTED_EXACT_NAMES: Set[str] = {
    "dockerfile",
    "procfile",
    "render.yaml",
    "fly.toml",
    ".env.example",
}

# Directories to exclude unconditionally (docs/BRAIN.md §11)
EXCLUDED_DIRS: Set[str] = {
    "node_modules",
    "venv",
    ".venv",
    "env",
    ".env",
    "__pycache__",
    "dist",
    "build",
    ".git",
    ".github",
    ".pytest_cache",
    ".mypy_cache",
    ".tox",
    "site-packages",
    "htmlcov",
    "eggs",
    ".eggs",
    ".agents",
    ".gemini",
    "scratch",
    ".vscode",
    ".idea",
}

# Lockfiles and generated files to skip
LOCKFILES: Set[str] = {
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "poetry.lock",
    "pipfile.lock",
    "composer.lock",
    "cargo.lock",
}

# Patterns indicating potential secrets or sensitive keys (docs/BRAIN.md §11, §18)
SECRET_PATTERNS: Tuple[str, ...] = (
    ".env",
    ".pem",
    ".key",
    ".cert",
    ".crt",
    "id_rsa",
    "id_ed25519",
    "secret",
    "credential",
    "token",
)

# Binary extensions to skip immediately
BINARY_EXTENSIONS: Set[str] = {
    ".pyc", ".pyo", ".pyd", ".so", ".dll", ".dylib", ".exe", ".bin",
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".webp", ".pdf",
    ".zip", ".tar", ".gz", ".7z", ".rar", ".woff", ".woff2", ".ttf", ".eot",
    ".mp3", ".mp4", ".mov", ".db", ".sqlite", ".sqlite3"
}


def is_secret_like(path: str) -> bool:
    """Returns True if the path appears to contain secrets or credentials,

    excluding safe template examples like .env.example.
    """
    basename = os.path.basename(path).lower()
    if basename in (".env.example", ".env.sample", ".env.template"):
        return False
    
    if basename == ".env" or basename.startswith(".env."):
        return True

    for pattern in SECRET_PATTERNS:
        if pattern in basename:
            return True

    return False


def is_in_excluded_dir(path: str) -> bool:
    """Checks whether any segment of the file path is an excluded directory."""
    parts = Path(path).parts
    for part in parts[:-1]:  # check directory components only
        if part.lower() in EXCLUDED_DIRS:
            return True
    return False


def categorize_file(
    path: str,
    size: Optional[int],
    max_file_bytes: int = 100000,
) -> Tuple[bool, Optional[str]]:
    """Categorizes whether a Git tree entry is analyzable or skipped.

    Returns:
        (is_analyzable: bool, skip_reason: Optional[str])
    """
    path_lower = path.lower()
    basename = os.path.basename(path_lower)
    _, ext = os.path.splitext(path_lower)

    # 1. Excluded directory check
    if is_in_excluded_dir(path):
        return False, "excluded_dir"

    # 2. Secret-like check
    if is_secret_like(path):
        return False, "secret_like"

    # 3. Binary extension check
    if ext in BINARY_EXTENSIONS:
        return False, "binary"

    # 4. Lockfile check
    if basename in LOCKFILES:
        return False, "lockfile"

    # 5. File size check (if size is known from GitHub tree)
    if size is not None and size > max_file_bytes:
        return False, "size_exceeded"

    # 6. Supported extension or exact name
    is_supported = (ext in SUPPORTED_EXTENSIONS) or (
        basename in SUPPORTED_EXACT_NAMES or basename.startswith("dockerfile")
    )
    if not is_supported:
        return False, "unsupported_ext"

    return True, None


def filter_tree_files(
    tree_entries: List[Dict],
    max_files_analyzed: int = 150,
    max_file_bytes: int = 100000,
    truncated: bool = False,
) -> Tuple[List[Dict], Scope]:
    """Filters tree entries from GitHub GET /git/trees/{sha}?recursive=1.

    Args:
        tree_entries: List of tree items from GitHub API (type='blob').
        max_files_analyzed: Hard cap on analyzed files (docs/BRAIN.md §11).
        max_file_bytes: Maximum size for single file.
        truncated: Whether GitHub API indicated truncated=true.

    Returns:
        (analyzable_entries, scope_summary)
    """
    analyzable: List[Dict] = []
    skipped_reasons: Dict[str, int] = {
        "excluded_dir": 0,
        "binary": 0,
        "size_exceeded": 0,
        "unsupported_ext": 0,
        "lockfile": 0,
        "secret_like": 0,
        "max_limit_exceeded": 0,
    }

    total_skipped = 0

    valid_candidates: List[Dict] = []
    for item in tree_entries:
        if item.get("type") != "blob":
            continue

        path = item.get("path", "")
        size = item.get("size")

        can_analyze, reason = categorize_file(path, size, max_file_bytes)

        if can_analyze:
            valid_candidates.append(item)
        else:
            total_skipped += 1
            if reason:
                skipped_reasons[reason] = skipped_reasons.get(reason, 0) + 1

    def _file_priority(it: Dict) -> int:
        p = it.get("path", "").lower()
        parts = p.split("/")
        is_doc = any(part in ("docs", "docs_src", "doc", "documentation", "examples", "tutorial") for part in parts)
        is_test = any(part in ("tests", "test", "testing") for part in parts)

        # Tier 0: Root deployment / manifest / config
        if "dockerfile" in p or p.endswith(("docker-compose.yml", "requirements.txt", "pyproject.toml", "setup.py", "setup.cfg", "render.yaml", "fly.toml", "procfile")):
            return 0

        # Tier 1: Core application/package source code (non-doc, non-test)
        if p.endswith((".py", ".sql")) and not is_test and not is_doc:
            return 1

        # Tier 2: Automated test files
        if p.endswith(".py") and is_test:
            return 2

        # Tier 3: Code examples & docs code snippets
        if p.endswith((".py", ".sql")) and is_doc:
            return 3

        # Tier 4: Other configs / YAML
        if p.endswith((".toml", ".cfg", ".yaml", ".yml", ".txt")):
            return 4

        # Tier 5: Documentation markdown
        if p.endswith(".md"):
            return 5

        return 6

    valid_candidates.sort(key=_file_priority)

    for item in valid_candidates:
        if len(analyzable) < max_files_analyzed:
            analyzable.append(item)
        else:
            total_skipped += 1
            skipped_reasons["max_limit_exceeded"] = skipped_reasons.get("max_limit_exceeded", 0) + 1

    # Remove zero-count reasons for cleaner reporting
    active_reasons = {k: v for k, v in skipped_reasons.items() if v > 0}

    scope = Scope(
        analyzed=len(analyzable),
        skipped=total_skipped,
        skipped_reasons=active_reasons,
        truncated=truncated or (skipped_reasons["max_limit_exceeded"] > 0),
    )

    return analyzable, scope
