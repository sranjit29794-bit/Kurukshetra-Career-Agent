"""Python language proficiency detector.

Reference: docs/BRAIN.md (§11).
Strong signal: non-trivial functions/classes with real bodies, type annotations, or class hierarchies.
Weak signal: empty/pass-only defs, only scripts of prints, syntax errors.
"""

from __future__ import annotations

import ast

from backend.app.detectors.base import BaseDetector, compute_blob_sha, compute_signal_id
from backend.app.detectors.weak_signals import is_empty_or_pass_only
from backend.app.schemas import Signal, SignalStrength


class PythonLangDetector(BaseDetector):
    """Detector for general Python language proficiency."""

    name: str = "python"

    def detect(
        self,
        path: str,
        content: str,
        blob_sha: str | None = None,
        all_files: dict[str, str] | None = None,
    ) -> list[Signal]:
        """Analyze a Python file for structured code definitions."""
        if not path.endswith(".py"):
            return []

        sha = blob_sha or compute_blob_sha(content)
        signals: list[Signal] = []
        lines = content.splitlines()

        try:
            tree = ast.parse(content, filename=path)
        except SyntaxError as err:
            sig_id = compute_signal_id(
                self.name, path, err.lineno or 1, err.lineno or 1, sha
            )
            signals.append(
                Signal(
                    signal_id=sig_id,
                    detector=self.name,
                    strength=SignalStrength.weak,
                    file_path=path,
                    line_start=err.lineno or 1,
                    line_end=err.lineno or 1,
                    snippet=lines[err.lineno - 1]
                    if err.lineno and err.lineno <= len(lines)
                    else "",
                    blob_sha=sha,
                    reason=f"SyntaxError in {path}: {err.msg}",
                    counted=False,
                )
            )
            return signals

        # Scan for classes and functions
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                line_start = node.lineno
                line_end = node.end_lineno or line_start
                snippet = "\n".join(lines[line_start - 1 : line_end])

                if is_empty_or_pass_only(node):
                    sig_id = compute_signal_id(
                        self.name, path, line_start, line_end, sha
                    )
                    signals.append(
                        Signal(
                            signal_id=sig_id,
                            detector=self.name,
                            strength=SignalStrength.weak,
                            file_path=path,
                            line_start=line_start,
                            line_end=line_end,
                            snippet=snippet,
                            blob_sha=sha,
                            reason=f"Empty or pass-only function '{node.name}'",
                            counted=False,
                        )
                    )
                else:
                    sig_id = compute_signal_id(
                        self.name, path, line_start, line_end, sha
                    )
                    signals.append(
                        Signal(
                            signal_id=sig_id,
                            detector=self.name,
                            strength=SignalStrength.strong,
                            file_path=path,
                            line_start=line_start,
                            line_end=line_end,
                            snippet=snippet,
                            blob_sha=sha,
                            reason=f"Implemented Python function '{node.name}' with {len(node.body)} statements",
                            counted=True,
                        )
                    )

            elif isinstance(node, ast.ClassDef):
                line_start = node.lineno
                line_end = node.end_lineno or line_start
                snippet = "\n".join(lines[line_start - 1 : line_end])
                sig_id = compute_signal_id(self.name, path, line_start, line_end, sha)
                signals.append(
                    Signal(
                        signal_id=sig_id,
                        detector=self.name,
                        strength=SignalStrength.strong,
                        file_path=path,
                        line_start=line_start,
                        line_end=line_end,
                        snippet=snippet,
                        blob_sha=sha,
                        reason=f"Python class definition '{node.name}'",
                        counted=True,
                    )
                )

        return signals
