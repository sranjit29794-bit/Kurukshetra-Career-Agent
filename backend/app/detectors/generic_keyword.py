"""Generic keyword detector for unmapped skills.

Reference: docs/BRAIN.md (§10.3, §11).
Used when no taxonomy detector matches a requirement.
Medium signal: multiple distinct search_term occurrences in source code files.
Weak signal (ignored, counted=False): search_terms found only in comments/README.
Note: Generic keyword detector NEVER produces a strong signal.
"""

from __future__ import annotations

import re

from backend.app.detectors.base import BaseDetector, compute_blob_sha, compute_signal_id
from backend.app.detectors.weak_signals import is_readme_or_doc
from backend.app.schemas import Signal, SignalStrength


class GenericKeywordDetector(BaseDetector):
    """Detector for arbitrary skills via search term pattern matching."""

    name: str = "generic_keyword"

    def __init__(
        self,
        search_terms: list[str] | None = None,
        keywords: list[str] | None = None,
    ) -> None:
        self.search_terms = search_terms or keywords or []

    def detect_with_terms(
        self,
        path: str,
        content: str,
        search_terms: list[str],
        blob_sha: str | None = None,
    ) -> list[Signal]:
        """Scan file for occurrences of given search terms."""
        sha = blob_sha or compute_blob_sha(content)
        signals: list[Signal] = []
        lines = content.splitlines()
        is_doc = is_readme_or_doc(path)

        for term in search_terms:
            if not term.strip():
                continue

            pattern = re.compile(rf"\b{re.escape(term.strip())}\b", re.IGNORECASE)
            for idx, line in enumerate(lines, start=1):
                if pattern.search(line):
                    sig_id = compute_signal_id(self.name, path, idx, idx, sha)
                    is_comment = line.strip().startswith("#") or is_doc
                    strength = (
                        SignalStrength.weak if is_comment else SignalStrength.medium
                    )
                    reason = (
                        f"Search term '{term}' mentioned in doc/comment"
                        if is_comment
                        else f"Occurrence of skill keyword '{term}' in code"
                    )
                    signals.append(
                        Signal(
                            signal_id=sig_id,
                            detector=self.name,
                            strength=strength,
                            file_path=path,
                            line_start=idx,
                            line_end=idx,
                            snippet=line.strip(),
                            blob_sha=sha,
                            reason=reason,
                            counted=not is_comment,
                        )
                    )

        return signals

    def detect(
        self,
        path: str,
        content: str,
        blob_sha: str | None = None,
        all_files: dict[str, str] | None = None,
    ) -> list[Signal]:
        """Detect using configured search terms."""
        return self.detect_with_terms(path, content, self.search_terms, blob_sha)
