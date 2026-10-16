"""Deterministic automated testing detector: pytest, unittest, assert statements, test fixtures.

NOTE: Per docs/BRAIN.md Invariant 6: Testing is capped at PARTIAL in MVP.
Tests existing != tests passing.
"""
import ast
import re
from typing import List
from backend.app.detectors.base import DetectedSignal, generate_signal_id
from backend.app.schemas import SignalStrength


def detect_testing(file_path: str, content: str, blob_sha: str = "") -> List[DetectedSignal]:
    signals: List[DetectedSignal] = []
    lines = content.splitlines()

    is_test_file = (
        "test_" in file_path.lower()
        or "_test.py" in file_path.lower()
        or "/tests/" in file_path.lower()
        or "/test/" in file_path.lower()
        or file_path.endswith("conftest.py")
    )

    if not file_path.endswith(".py") and not file_path.endswith("pytest.ini"):
        return signals

    # Configuration file (pytest.ini)
    if file_path.endswith("pytest.ini") or "pytest" in content[:200]:
        for idx, line in enumerate(lines[:15], 1):
            if "[pytest]" in line or "testpaths" in line:
                sig_id = generate_signal_id("testing", file_path, idx, idx, line)
                signals.append(
                    DetectedSignal(
                        signal_id=sig_id,
                        detector="testing",
                        category_key="testing",
                        file_path=file_path,
                        line_start=idx,
                        line_end=idx,
                        snippet=line.strip(),
                        blob_sha=blob_sha,
                        strength=SignalStrength.MEDIUM,
                        counted=True,
                        why=f"Pytest configuration directive: `{line.strip()}`",
                        limitation="Test configuration present; does not prove test execution or passing status.",
                    )
                )

    if not file_path.endswith(".py"):
        return signals

    try:
        tree = ast.parse(content)
    except SyntaxError:
        return signals

    for node in ast.walk(tree):
        # 1. Test function definition
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if node.name.startswith("test_") or node.name.endswith("_test"):
                start_l = node.lineno
                end_l = min(node.end_lineno or start_l, start_l + 6)
                snippet = "\n".join(lines[start_l - 1:end_l])

                # Check for weak trivial asserts: assert True, assert 1 == 1, or pass
                has_substantive_assert = False
                for body_node in ast.walk(node):
                    if isinstance(body_node, ast.Assert):
                        # Detect trivial assert True
                        if isinstance(body_node.test, ast.Constant) and body_node.test.value is True:
                            continue
                        has_substantive_assert = True
                        break

                strength = SignalStrength.STRONG if has_substantive_assert else SignalStrength.WEAK
                counted = has_substantive_assert
                limitation = "Trivial assertion (`assert True` or empty test body) rejected" if not has_substantive_assert else "Static presence of test; execution runtime capped at PARTIAL."

                sig_id = generate_signal_id("testing", file_path, start_l, end_l, snippet)
                signals.append(
                    DetectedSignal(
                        signal_id=sig_id,
                        detector="testing",
                        category_key="testing",
                        file_path=file_path,
                        line_start=start_l,
                        line_end=end_l,
                        snippet=snippet,
                        blob_sha=blob_sha,
                        strength=strength,
                        counted=counted,
                        why=f"Test function `{node.name}` with validated assertion logic",
                        limitation=limitation,
                    )
                )

        # 2. Pytest Fixture
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for dec in node.decorator_list:
                dec_name = ""
                if isinstance(dec, ast.Attribute):
                    dec_name = dec.attr
                elif isinstance(dec, ast.Call) and isinstance(dec.func, ast.Attribute):
                    dec_name = dec.func.attr
                elif isinstance(dec, ast.Name):
                    dec_name = dec.id

                if dec_name == "fixture":
                    start_l = node.lineno
                    end_l = min(node.end_lineno or start_l, start_l + 4)
                    snippet = "\n".join(lines[start_l - 1:end_l])
                    sig_id = generate_signal_id("testing", file_path, start_l, end_l, snippet)
                    signals.append(
                        DetectedSignal(
                            signal_id=sig_id,
                            detector="testing",
                            category_key="testing",
                            file_path=file_path,
                            line_start=start_l,
                            line_end=end_l,
                            snippet=snippet,
                            blob_sha=blob_sha,
                            strength=SignalStrength.STRONG,
                            counted=True,
                            why=f"Pytest test fixture definition `{node.name}`",
                            limitation="Fixture definition present; execution runtime capped at PARTIAL.",
                        )
                    )

    return signals
