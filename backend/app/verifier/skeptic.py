"""Skeptic Verifier: Validates that cited line ranges actually exist and match

the file content at the analyzed commit.

Hard Invariants (docs/BRAIN.md §3, §10):
- Verifier re-checks every citation against the raw file content at that commit.
- Snippet mismatch -> drop signal or mark unverified.
- Never allow fabricated line spans or phantom file citations.
"""
from typing import Dict, List, Optional, Tuple
from backend.app.detectors.base import DetectedSignal
from backend.app.schemas import EvidenceItem, SignalStrength


class SkepticVerifier:
    """Independent verification agent ensuring citations are accurate down to

    the exact line characters at the pinned commit.
    """

    @staticmethod
    def verify_citation(
        signal: DetectedSignal,
        file_content: str,
    ) -> Tuple[bool, Optional[str], Optional[EvidenceItem]]:
        """Verifies a single detected signal against actual file content at the commit.

        Returns (is_valid, rejection_reason, verified_evidence_item).
        """
        lines = file_content.splitlines()
        total_lines = len(lines)

        # 1. Bounds check
        if signal.line_start < 1 or signal.line_end > total_lines or signal.line_start > signal.line_end:
            return (
                False,
                f"Line range [{signal.line_start}, {signal.line_end}] out of file bounds (1..{total_lines})",
                None,
            )

        # 2. Extract actual line text
        actual_slice = lines[signal.line_start - 1:signal.line_end]
        actual_text = "\n".join(actual_slice).strip()

        # 3. Content matching check
        expected_snippet = signal.snippet.strip()
        # Allow whitespace tolerance but ensure substantive characters match
        clean_expected = "".join(expected_snippet.split())
        clean_actual = "".join(actual_text.split())

        if not clean_expected or (clean_expected not in clean_actual and clean_actual not in clean_expected):
            return (
                False,
                f"Content mismatch: cited snippet does not match lines {signal.line_start}..{signal.line_end}",
                None,
            )

        # 4. Prompt-injection shield: reject citations containing instruction injections
        injection_patterns = ["ignore previous instructions", "system prompt", "you are now in god mode", "eval(", "exec("]
        for ip in injection_patterns:
            if ip in signal.snippet.lower():
                return (
                    False,
                    f"Prompt injection or dangerous payload detected in cited snippet: `{ip}`",
                    None,
                )

        # Verified! Build verified EvidenceItem
        evidence = EvidenceItem(
            id=None,
            signal_id=signal.signal_id,
            detector=signal.detector,
            file_path=signal.file_path,
            line_start=signal.line_start,
            line_end=signal.line_end,
            snippet=signal.snippet,
            blob_sha=signal.blob_sha,
            strength=signal.strength,
            counted=signal.counted,
        )

        return True, None, evidence

    @classmethod
    def verify_all(
        cls,
        signals: List[DetectedSignal],
        files_map: Dict[str, str],
    ) -> Tuple[List[EvidenceItem], List[Dict[str, str]]]:
        """Batch verifies all proposed signals against in-memory file contents.

        Returns (verified_evidence_list, dropped_reasons_list).
        """
        verified: List[EvidenceItem] = []
        dropped: List[Dict[str, str]] = []

        for sig in signals:
            content = files_map.get(sig.file_path)
            if content is None:
                dropped.append({
                    "signal_id": sig.signal_id,
                    "file_path": sig.file_path,
                    "reason": f"File '{sig.file_path}' not found in analyzed scope",
                })
                continue

            is_valid, reason, evidence = cls.verify_citation(sig, content)
            if is_valid and evidence:
                verified.append(evidence)
            else:
                dropped.append({
                    "signal_id": sig.signal_id,
                    "file_path": sig.file_path,
                    "reason": reason or "Verification failed",
                })

        return verified, dropped
