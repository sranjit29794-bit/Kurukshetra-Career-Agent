"""GitHub integration module for DevProof.

Provides async GitHub client and file filtering per BRAIN §11, §14.
"""

from backend.app.github.client import GitHubAPIError, GitHubClient, get_github_client
from backend.app.github.files import filter_repo_tree

__all__ = [
    "GitHubAPIError",
    "GitHubClient",
    "filter_repo_tree",
    "get_github_client",
]
