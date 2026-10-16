"""Testing proficiency detector.

Reference: docs/BRAIN.md (§3 Invariant #6, §11) and PLAN-5H (Phase EN-1).
Strong signal:
  - test_*.py / *_test.py or files under tests/
  - test_* functions containing meaningful assertions on project calls or pytest.raises
Weak signal (ignored, counted=False):
  - assert True, assert 1 == 1, assert False
  - No asserts, empty body, pass
  - Tests that do not import project code
  - Testing claims in README or comments only
"""

from __future__ import annotations

import ast
import re

from backend.app.detectors.base import BaseDetector, compute_blob_sha, compute_signal_id
from backend.app.detectors.weak_signals import (
    is_empty_or_pass_only,
    is_readme_or_doc,
    is_trivial_assert_node,
)
from backend.app.schemas import Signal, SignalStrength


class TestingDetector(BaseDetector):
    """Detector for automated testing and test suites."""

    name: str = "testing"

    def detect(
        self,
        path: str,
        content: str,
        blob_sha: str | None = None,
        all_files: dict[str, str] | None = None,
    ) -> list[Signal]:
        """Inspect test files for real assertion suites."""
        sha = blob_sha or compute_blob_sha(content)
        signals: list[Signal] = []
        lines = content.splitlines()

        # 1. README check: claims about testing in README are WEAK
        if is_readme_or_doc(path):
            if re.search(
                r"\b(test|tests|testing|pytest|unittest|coverage|tdd)\b",
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
                        reason="README claims testing or test coverage without code verification",
                        counted=False,
                    )
                )
            return signals

        # 2. Only test files (test_*.py, *_test.py, or inside tests/ directory)
        is_test_file = (
            path.startswith("tests/")
            or "/tests/" in path
            or path.startswith("test/")
            or path.endswith("_test.py")
            or ("test_" in path and path.endswith(".py"))
        )
        if not is_test_file or not path.endswith(".py"):
            return []

        try:
            tree = ast.parse(content, filename=path)
        except SyntaxError:
            return []

        # Check imports in this test file
        imported_modules: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imported_modules.add(alias.name.split(".")[0])
            elif isinstance(node, ast.ImportFrom) and node.module:
                imported_modules.add(node.module.split(".")[0])

        # Check if project code is imported (excluding stdlib / testing frameworks)
        system_libs = {
            "pytest",
            "unittest",
            "mock",
            "unittest.mock",
            "sys",
            "os",
            "json",
            "time",
        }
        has_project_imports = any(mod not in system_libs for mod in imported_modules)

        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                if not node.name.startswith("test_"):
                    continue

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
                            reason=f"Test function '{node.name}' has empty or pass-only body",
                            counted=False,
                        )
                    )
                    continue

                # Find all assert statements and pytest.raises calls
                assert_nodes: list[ast.Assert] = []
                has_pytest_raises = False

                for inner in ast.walk(node):
                    if isinstance(inner, ast.Assert):
                        assert_nodes.append(inner)
                    elif isinstance(inner, ast.With):
                        for item in inner.items:
                            if isinstance(item.context_expr, ast.Call):
                                func = item.context_expr.func
                                if (
                                    isinstance(func, ast.Attribute)
                                    and func.attr == "raises"
                                ):
                                    has_pytest_raises = True

                if not assert_nodes and not has_pytest_raises:
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
                            reason=f"Test function '{node.name}' contains no assert statements or exception checks",
                            counted=False,
                        )
                    )
                    continue

                # Check if all asserts are trivial (assert True / assert 1 == 1)
                all_trivial = (
                    assert_nodes
                    and all(is_trivial_assert_node(a) for a in assert_nodes)
                    and not has_pytest_raises
                )
                if all_trivial:
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
                            reason=f"Test function '{node.name}' contains only trivial assertions (e.g. 'assert True')",
                            counted=False,
                        )
                    )
                    continue

                # Check if test imports project code
                if not has_project_imports:
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
                            reason=f"Test function '{node.name}' does not import any project code modules",
                            counted=False,
                        )
                    )
                    continue

                # Meaningful assertion test case
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
                        reason=f"Automated test '{node.name}' with meaningful assertions against project code",
                        counted=True,
                    )
                )

        return signals
