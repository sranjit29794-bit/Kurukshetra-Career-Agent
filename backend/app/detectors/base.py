"""Base detector classes and signal generation utilities.

Reference: docs/BRAIN.md (§3, §10.2, §10.3, §11) and rule 10-engine-invariants.
"""

from __future__ import annotations

import hashlib
from abc import ABC, abstractmethod

from backend.app.schemas import Signal


def compute_blob_sha(content: str) -> str:
    """Calculate standard Git blob SHA-1 for a string content."""
    encoded = content.encode("utf-8")
    header = f"blob {len(encoded)}\0".encode()
    return hashlib.sha1(header + encoded).hexdigest()


def compute_signal_id(
    detector: str,
    file_path: str,
    line_start: int,
    line_end: int,
    blob_sha: str,
) -> str:
    """Produce a deterministic, stable SHA-256 identifier for an evidence signal.

    signal_id = stable hash of (detector, path, line_start, line_end, blob_sha).
    Same input -> exact same id across runs.
    """
    key = f"{detector}:{file_path}:{line_start}:{line_end}:{blob_sha}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


class BaseDetector(ABC):
    """Abstract base class for all deterministic skill detectors."""

    name: str = "base"

    @abstractmethod
    def detect(
        self,
        path: str,
        content: str,
        blob_sha: str | None = None,
        all_files: dict[str, str] | None = None,
    ) -> list[Signal]:
        """Analyze a single file's content and return identified signals.

        Must never execute file code or crash on syntax errors.
        """
        ...
