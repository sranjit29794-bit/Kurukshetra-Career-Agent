"""Deterministic deployment & containerization detector: Dockerfile, docker-compose, CI workflows.

NOTE: Per docs/BRAIN.md Invariant 6: Deployment is capped at PARTIAL in MVP.
Config existing != deployed.
"""
import re
from typing import List
from backend.app.detectors.base import DetectedSignal, generate_signal_id
from backend.app.schemas import SignalStrength


def detect_deployment(file_path: str, content: str, blob_sha: str = "") -> List[DetectedSignal]:
    signals: List[DetectedSignal] = []
    lines = content.splitlines()
    lower_path = file_path.lower()

    # 1. Dockerfile
    if "dockerfile" in lower_path:
        for idx, line in enumerate(lines[:20], 1):
            if re.match(r"^(FROM|ENTRYPOINT|CMD|EXPOSE|WORKDIR)\s+", line, re.IGNORECASE):
                snippet = "\n".join(lines[idx - 1:min(len(lines), idx + 4)])
                sig_id = generate_signal_id("deployment", file_path, idx, min(len(lines), idx + 4), snippet)
                signals.append(
                    DetectedSignal(
                        signal_id=sig_id,
                        detector="deployment",
                        category_key="deployment",
                        file_path=file_path,
                        line_start=idx,
                        line_end=min(len(lines), idx + 4),
                        snippet=snippet,
                        blob_sha=blob_sha,
                        strength=SignalStrength.MEDIUM,
                        counted=True,
                        why=f"Dockerfile container directive: `{line.strip()}`",
                        limitation="Container configuration present; does not prove active deployment (capped at PARTIAL).",
                    )
                )
                break

    # 2. Compose file (docker-compose.yml / compose.yaml)
    elif "compose" in lower_path and (lower_path.endswith(".yml") or lower_path.endswith(".yaml")):
        for idx, line in enumerate(lines[:25], 1):
            if "services:" in line or "image:" in line or "build:" in line:
                snippet = "\n".join(lines[idx - 1:min(len(lines), idx + 5)])
                sig_id = generate_signal_id("deployment", file_path, idx, min(len(lines), idx + 5), snippet)
                signals.append(
                    DetectedSignal(
                        signal_id=sig_id,
                        detector="deployment",
                        category_key="deployment",
                        file_path=file_path,
                        line_start=idx,
                        line_end=min(len(lines), idx + 5),
                        snippet=snippet,
                        blob_sha=blob_sha,
                        strength=SignalStrength.MEDIUM,
                        counted=True,
                        why=f"Docker compose service configuration: `{line.strip()}`",
                        limitation="Compose manifest present; does not prove active cloud deployment (capped at PARTIAL).",
                    )
                )
                break

    # 3. CI / Workflow files (GitHub actions, etc.)
    elif ".github/workflows" in lower_path or "render.yaml" in lower_path or "fly.toml" in lower_path:
        for idx, line in enumerate(lines[:25], 1):
            if "jobs:" in line or "steps:" in line or "runs-on:" in line:
                snippet = "\n".join(lines[idx - 1:min(len(lines), idx + 5)])
                sig_id = generate_signal_id("deployment", file_path, idx, min(len(lines), idx + 5), snippet)
                signals.append(
                    DetectedSignal(
                        signal_id=sig_id,
                        detector="deployment",
                        category_key="deployment",
                        file_path=file_path,
                        line_start=idx,
                        line_end=min(len(lines), idx + 5),
                        snippet=snippet,
                        blob_sha=blob_sha,
                        strength=SignalStrength.MEDIUM,
                        counted=True,
                        why=f"Continuous integration / deployment pipeline config: `{line.strip()}`",
                        limitation="CI/CD manifest present; runtime execution capped at PARTIAL.",
                    )
                )
                break

    return signals
