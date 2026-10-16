"""Deployment & Containerization detector.

Reference: docs/BRAIN.md (§3 Invariant #6, §11) and PLAN-5H (Phase EN-1).
Strong signal:
  - Dockerfile with FROM and CMD / ENTRYPOINT referencing service
  - docker-compose.yml / Procfile / render.yaml / fly.toml
Weak signal (ignored, counted=False):
  - README says "deployed" or "live at http..."
  - Empty or trivial Dockerfile
"""

from __future__ import annotations

import re

from backend.app.detectors.base import BaseDetector, compute_blob_sha, compute_signal_id
from backend.app.detectors.weak_signals import is_readme_or_doc
from backend.app.schemas import Signal, SignalStrength


class DeploymentDetector(BaseDetector):
    """Detector for Docker containerization and cloud deployment configs."""

    name: str = "deployment"

    def detect(
        self,
        path: str,
        content: str,
        blob_sha: str | None = None,
        all_files: dict[str, str] | None = None,
    ) -> list[Signal]:
        """Analyze infra/docker files for container deployment definitions."""
        sha = blob_sha or compute_blob_sha(content)
        signals: list[Signal] = []
        lines = content.splitlines()
        filename_lower = path.split("/")[-1].lower()

        # 1. README check: claims about deployment in README are WEAK
        if is_readme_or_doc(path):
            if re.search(
                r"\b(deployed|deploy|docker|container|kubernetes|aws|render|fly\.io|heroku)\b",
                content,
                re.IGNORECASE,
            ):
                sig_id = compute_signal_id(self.name, path, 1, min(5, len(lines)), sha)
                signals.append(
                    Signal(
                        signal_id=sig_id,
                        detector=self.name,
                        strength=SignalStrength.weak,
                        file_path=path,
                        line_start=1,
                        line_end=min(5, len(lines)),
                        snippet="\n".join(lines[: min(5, len(lines))]),
                        blob_sha=sha,
                        reason="README or documentation claims deployment without verified infra config",
                        counted=False,
                    )
                )
            return signals

        # 2. Dockerfile inspection
        if filename_lower == "dockerfile" or filename_lower.startswith("dockerfile."):
            has_from = bool(
                re.search(r"^\s*FROM\s+\S+", content, re.MULTILINE | re.IGNORECASE)
            )
            has_cmd = bool(
                re.search(
                    r"^\s*(CMD|ENTRYPOINT)\s+", content, re.MULTILINE | re.IGNORECASE
                )
            )

            if has_from and has_cmd:
                sig_id = compute_signal_id(self.name, path, 1, min(10, len(lines)), sha)
                signals.append(
                    Signal(
                        signal_id=sig_id,
                        detector=self.name,
                        strength=SignalStrength.strong,
                        file_path=path,
                        line_start=1,
                        line_end=min(10, len(lines)),
                        snippet="\n".join(lines[: min(10, len(lines))]),
                        blob_sha=sha,
                        reason="Dockerfile with valid base image (FROM) and service startup instruction (CMD/ENTRYPOINT)",
                        counted=True,
                    )
                )
            else:
                sig_id = compute_signal_id(self.name, path, 1, min(5, len(lines)), sha)
                signals.append(
                    Signal(
                        signal_id=sig_id,
                        detector=self.name,
                        strength=SignalStrength.medium,
                        file_path=path,
                        line_start=1,
                        line_end=min(5, len(lines)),
                        snippet="\n".join(lines[: min(5, len(lines))]),
                        blob_sha=sha,
                        reason="Incomplete Dockerfile missing startup command or base image",
                        counted=True,
                    )
                )
            return signals

        # 3. docker-compose, Procfile, render.yaml, fly.toml
        if filename_lower in (
            "docker-compose.yml",
            "docker-compose.yaml",
            "procfile",
            "render.yaml",
            "fly.toml",
        ):
            sig_id = compute_signal_id(self.name, path, 1, min(10, len(lines)), sha)
            signals.append(
                Signal(
                    signal_id=sig_id,
                    detector=self.name,
                    strength=SignalStrength.strong,
                    file_path=path,
                    line_start=1,
                    line_end=min(10, len(lines)),
                    snippet="\n".join(lines[: min(10, len(lines))]),
                    blob_sha=sha,
                    reason=f"Deployment or container orchestration manifest '{filename_lower}'",
                    counted=True,
                )
            )

        return signals
