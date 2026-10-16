"""Helper utilities for loading repository fixtures in memory.

Reference: docs/PLAN-5H.md (§5 EN-1) and rule 30-testing-standards.
"""

from __future__ import annotations

from pathlib import Path

from backend.app.detectors.base import compute_blob_sha
from backend.app.github.files import filter_repo_tree
from backend.app.schemas import CommitInfo, RepoFile, RepoSnapshot

REPOS_DIR = Path(__file__).resolve().parent / "repos"


def load_repo_fixture_files(repo_name: str, subpath: str = "") -> dict[str, str]:
    """Read all files from a repository fixture directory into an in-memory dict."""
    base_dir = REPOS_DIR / repo_name
    if subpath:
        base_dir = base_dir / subpath

    if not base_dir.exists():
        raise FileNotFoundError(f"Fixture repository directory not found: {base_dir}")

    files: dict[str, str] = {}
    for file_path in base_dir.rglob("*"):
        if file_path.is_file():
            if "__pycache__" in file_path.parts or file_path.suffix == ".pyc":
                continue
            rel_path = file_path.relative_to(base_dir).as_posix()
            files[rel_path] = file_path.read_text(encoding="utf-8", errors="replace")
    return files


def load_repo_fixture_snapshot(
    repo_name: str,
    commit_or_subpath: str = "",
    sha: str = "a1b2c3d4e5f67890123456789abcdef012345678",
    message: str = "test fixture commit",
) -> RepoSnapshot:
    """Build a RepoSnapshot object from an in-memory fixture repository."""
    files_dict = load_repo_fixture_files(repo_name, commit_or_subpath)

    tree_entries = []
    for path, content in files_dict.items():
        tree_entries.append(
            {
                "type": "blob",
                "path": path,
                "size": len(content.encode("utf-8")),
                "sha": compute_blob_sha(content),
            }
        )

    analyzed_entries, scope = filter_repo_tree(tree_entries)

    repo_files = []
    for entry in analyzed_entries:
        path = entry["path"]
        repo_files.append(
            RepoFile(
                path=path,
                blob_sha=entry["sha"],
                size_bytes=entry["size"],
                content=files_dict.get(path, ""),
            )
        )

    commit_info = CommitInfo(
        sha=sha,
        message=message,
        author="DevProof Tester",
        date="2026-10-17T00:00:00Z",
    )

    return RepoSnapshot(
        repo_url=f"https://github.com/devproof-test/{repo_name}",
        commit_sha=sha,
        commit_info=commit_info,
        files=repo_files,
        scope=scope,
    )
