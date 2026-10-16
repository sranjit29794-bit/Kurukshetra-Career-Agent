"""Repo Scout agent for inspecting GitHub repositories and capturing snapshots.

Reference: docs/BRAIN.md (§5, §11, §14) and docs/PLAN-5H.md (Phase BE-1).
"""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from backend.app.events import emit
from backend.app.github.client import GitHubAPIError, GitHubClient, get_github_client
from backend.app.github.files import filter_repo_tree
from backend.app.models import FileCacheModel
from backend.app.schemas import CommitInfo, RepoFile, RepoSnapshot


class RepoScout:
    """Agent that resolves commits, fetches trees, filters files, and builds commit-pinned snapshots."""

    def __init__(self, client: GitHubClient | None = None) -> None:
        self.client = client or get_github_client()

    @staticmethod
    def parse_repo_url(url: str) -> tuple[str, str, str | None]:
        """Parse various GitHub URL formats into (owner, repo_name, branch_override).

        Supports:
            - https://github.com/owner/repo
            - https://github.com/owner/repo.git
            - https://github.com/owner/repo/tree/my-branch
            - git@github.com:owner/repo.git
            - owner/repo
        """
        cleaned = url.strip()
        if not cleaned:
            raise GitHubAPIError("REPO_INVALID", "Empty repository URL", 400)

        # Handle SSH style git@github.com:owner/repo.git
        if cleaned.startswith("git@github.com:"):
            path = cleaned[len("git@github.com:") :]
            parts = [p for p in path.rstrip("/").split("/") if p]
            if len(parts) >= 2:
                owner = parts[0]
                name = parts[1].removesuffix(".git")
                return owner, name, None

        parsed = urlparse(cleaned)
        # If no scheme, treat as either github.com/owner/repo or owner/repo
        if not parsed.netloc:
            parts = [p for p in cleaned.rstrip("/").split("/") if p]
            if len(parts) == 2:
                return parts[0], parts[1].removesuffix(".git"), None
            if len(parts) >= 3 and parts[0] in ("github.com", "www.github.com"):
                owner = parts[1]
                name = parts[2].removesuffix(".git")
                branch = None
                if len(parts) >= 5 and parts[3] == "tree":
                    branch = parts[4]
                return owner, name, branch
            raise GitHubAPIError(
                "REPO_INVALID",
                f"Cannot parse repository coordinates from '{url}'",
                400,
            )

        if "github.com" not in parsed.netloc:
            raise GitHubAPIError(
                "REPO_INVALID",
                f"Only GitHub repositories are supported, got '{parsed.netloc}'",
                400,
            )

        path_parts = [p for p in parsed.path.strip("/").split("/") if p]
        if len(path_parts) < 2:
            raise GitHubAPIError(
                "REPO_INVALID",
                f"Repository URL missing owner/repo components in '{url}'",
                400,
            )

        owner = path_parts[0]
        name = path_parts[1].removesuffix(".git")
        branch = None

        if len(path_parts) >= 4 and path_parts[2] == "tree":
            branch = "/".join(path_parts[3:])

        # Clean any trailing special characters
        name = re.sub(r"[^\w.-]", "", name)
        owner = re.sub(r"[^\w.-]", "", owner)

        if not owner or not name:
            raise GitHubAPIError("REPO_INVALID", "Invalid repository coordinates", 400)

        return owner, name, branch

    async def validate_repo(
        self, repo_url: str
    ) -> tuple[dict[str, Any], str, str, str]:
        """Validate repository existence and accessibility.

        Returns:
            tuple of (repo_meta, owner, name, default_branch)
        """
        owner, name, branch_override = self.parse_repo_url(repo_url)
        repo_data = await self.client.get_repo(owner, name)

        default_branch = (
            branch_override
            if branch_override
            else repo_data.get("default_branch", "main")
        )
        return repo_data, owner, name, default_branch

    async def get_head_commit(self, owner: str, name: str, branch: str) -> CommitInfo:
        """Resolve the latest commit SHA and metadata for a branch."""
        data = await self.client.get_branch_commit(owner, name, branch)
        sha = data.get("sha", "")
        commit_obj = data.get("commit", {})
        message = commit_obj.get("message", "")
        author_name = commit_obj.get("author", {}).get("name", "")
        date = commit_obj.get("author", {}).get("date", "")

        return CommitInfo(
            sha=sha,
            message=message,
            author=author_name,
            date=date,
        )

    async def fetch_snapshot(
        self,
        repo_url: str,
        branch: str | None = None,
        db_session: Session | None = None,
        track_id: str = "",
    ) -> RepoSnapshot:
        """Fetch tree at branch HEAD SHA, filter files, read blobs, and build snapshot."""
        owner, name, url_branch = self.parse_repo_url(repo_url)
        target_branch = branch or url_branch

        if not target_branch:
            repo_meta = await self.client.get_repo(owner, name)
            target_branch = repo_meta.get("default_branch", "main")

        commit_info = await self.get_head_commit(owner, name, target_branch)
        short_sha = commit_info.sha[:7] if commit_info.sha else "unknown"

        await emit(
            agent="Repo Scout",
            message=f"Resolving tree at {owner}/{name}@{short_sha}",
            level="info",
            track_id=track_id,
        )

        tree_data = await self.client.get_tree(
            owner, name, commit_info.sha, recursive=True
        )
        raw_entries = tree_data.get("tree", [])
        is_github_truncated = bool(tree_data.get("truncated", False))

        analyzed_entries, scope = filter_repo_tree(
            raw_entries, github_truncated=is_github_truncated
        )

        files: list[RepoFile] = []
        for entry in analyzed_entries:
            path = entry.get("path", "")
            blob_sha = entry.get("sha", "")
            size_bytes = entry.get("size", 0)

            content = None
            if db_session is not None and blob_sha:
                cached = (
                    db_session.query(FileCacheModel)
                    .filter(FileCacheModel.blob_sha == blob_sha)
                    .first()
                )
                if cached:
                    content = cached.content

            if content is None and blob_sha:
                content = await self.client.get_blob(owner, name, blob_sha)
                if db_session is not None:
                    cache_entry = FileCacheModel(
                        blob_sha=blob_sha,
                        path=path,
                        content=content,
                    )
                    db_session.merge(cache_entry)
                    db_session.commit()

            files.append(
                RepoFile(
                    path=path,
                    blob_sha=blob_sha,
                    size_bytes=size_bytes,
                    content=content,
                )
            )

        await emit(
            agent="Repo Scout",
            message=f"Fetched {len(files)} files @ {short_sha} ({scope.skipped} skipped)",
            level="success",
            track_id=track_id,
        )

        return RepoSnapshot(
            repo_url=f"https://github.com/{owner}/{name}",
            commit_sha=commit_info.sha,
            commit_info=commit_info,
            files=files,
            scope=scope,
        )

    async def compare(
        self, repo_url: str, base_sha: str, head_sha: str
    ) -> dict[str, list[str]]:
        """Compute changed files between two commit SHAs."""
        owner, name, _ = self.parse_repo_url(repo_url)
        comp = await self.client.compare_commits(owner, name, base_sha, head_sha)
        files = comp.get("files", [])

        added: list[str] = []
        removed: list[str] = []
        modified: list[str] = []

        for f in files:
            filename = f.get("filename", "")
            status = f.get("status", "")
            if status == "added":
                added.append(filename)
            elif status == "removed":
                removed.append(filename)
            else:
                modified.append(filename)

        return {
            "files_added": added,
            "files_removed": removed,
            "files_modified": modified,
        }
