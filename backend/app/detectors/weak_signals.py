"""Weak-signal filtering and classification helpers.

Reference: docs/BRAIN.md (§3 Invariant #7, §10.2, §11).
Weak signals (comments, README claims, empty/pass-only defs, assert True,
assert 1 == 1, tests not importing project code, deps-only mentions)
must ALWAYS be recorded as ignored (counted=False) and NEVER counted.
"""

from __future__ import annotations

import ast
import re

# Match trivial assertions like 'assert True', 'assert 1 == 1', 'assert not False'
_TRIVIAL_ASSERT_RE = re.compile(
    r"^\s*assert\s+(?:True|1\s*==\s*1|0\s*==\s*0|False\s*==\s*False|None\s+is\s+None)\s*(?:,.*)?$",
    re.MULTILINE,
)


def is_trivial_assert_node(node: ast.Assert) -> bool:
    """Check if an AST assert statement is trivial (assert True or assert 1 == 1)."""
    # assert True / assert False
    if isinstance(node.test, ast.Constant) and isinstance(node.test.value, bool):
        return True

    # assert 1 == 1
    if (
        isinstance(node.test, ast.Compare)
        and isinstance(node.test.left, ast.Constant)
        and len(node.test.comparators) == 1
        and isinstance(node.test.comparators[0], ast.Constant)
    ):
        left_val = node.test.left.value
        right_val = node.test.comparators[0].value
        if left_val == right_val:
            return True

    return False


def is_empty_or_pass_only(node: ast.FunctionDef | ast.AsyncFunctionDef) -> bool:
    """Check if a function body has no real executable statements (only pass, docstring, or ellipsis)."""
    body = node.body
    if not body:
        return True

    # Filter out docstrings, pass statements, and Ellipsis (...)
    meaningful = []
    for stmt in body:
        if isinstance(stmt, ast.Pass):
            continue
        if isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Constant):
            # Check for docstring or Ellipsis
            continue
        meaningful.append(stmt)

    return len(meaningful) == 0


def is_readme_or_doc(file_path: str) -> bool:
    """Check if a file is documentation or a README."""
    lower = file_path.lower()
    return lower.endswith((".md", ".rst", ".txt")) and "requirements" not in lower
