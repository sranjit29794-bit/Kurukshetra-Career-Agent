"""SQL Database detector.

Reference: docs/BRAIN.md (§11) and PLAN-5H (Phase EN-1).
Strong signal:
  - .execute() / .executemany() with a SQL string literal AND parameter binding (?, %s, :name, tuple/list args).
  - SQLAlchemy select() / session.query() / text() with parameter bindings.
  - SQL migration scripts (.sql with DDL/DML statements).
Medium signal:
  - SQL query executed via f-string or string concatenation (flagged with unsafe note).
  - ORM model definitions only.
Weak signal (ignored, counted=False):
  - SQL in comments, docstrings, README claims.
  - sqlalchemy/psycopg2 only in requirements.txt.
"""

from __future__ import annotations

import ast
import re

from backend.app.detectors.base import BaseDetector, compute_blob_sha, compute_signal_id
from backend.app.detectors.weak_signals import is_readme_or_doc
from backend.app.schemas import Signal, SignalStrength

_SQL_KEYWORDS = re.compile(
    r"\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE)\b",
    re.IGNORECASE,
)


class SqlDatabaseDetector(BaseDetector):
    """Detector for SQL database integration and query writing."""

    name: str = "sql_database"

    def detect(
        self,
        path: str,
        content: str,
        blob_sha: str | None = None,
        all_files: dict[str, str] | None = None,
    ) -> list[Signal]:
        """Inspect code or migration files for SQL execution."""
        sha = blob_sha or compute_blob_sha(content)
        signals: list[Signal] = []
        lines = content.splitlines()

        # 1. README / Doc check: SQL mentions in README are ALWAYS weak
        if is_readme_or_doc(path):
            if re.search(
                r"\b(sql|postgres|postgresql|mysql|sqlite|database)\b",
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
                        reason="README or documentation claims SQL database without code implementation",
                        counted=False,
                    )
                )
            return signals

        # 2. Requirements.txt check: library presence only is WEAK
        if path.lower().endswith("requirements.txt") or path.lower().endswith(
            "pyproject.toml"
        ):
            if re.search(
                r"\b(sqlalchemy|psycopg|psycopg2|mysqlclient|asyncpg|aiosqlite)\b",
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
                        reason="Database driver or ORM library listed in dependencies only",
                        counted=False,
                    )
                )
            return signals

        # 3. .sql migration / schema files
        if path.endswith(".sql"):
            if _SQL_KEYWORDS.search(content):
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
                        reason="Dedicated SQL schema or migration script with SQL statements",
                        counted=True,
                    )
                )
            return signals

        if not path.endswith(".py"):
            return []

        try:
            tree = ast.parse(content, filename=path)
        except SyntaxError:
            return []

        # 4. AST scan for cursor.execute() / executemany() and SQLAlchemy query patterns
        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
                method_name = node.func.attr.lower()

                # Check cursor.execute / executemany
                if method_name in ("execute", "executemany"):
                    if not node.args:
                        continue

                    query_arg = node.args[0]
                    line_start = node.lineno
                    line_end = node.end_lineno or line_start
                    snippet = "\n".join(lines[line_start - 1 : line_end])

                    # Check if query argument is a string literal
                    if isinstance(query_arg, ast.Constant) and isinstance(
                        query_arg.value, str
                    ):
                        query_str = query_arg.value
                        if _SQL_KEYWORDS.search(query_str):
                            # Check parameter binding: second argument passed
                            has_binding = len(node.args) >= 2 or any(
                                kw.arg in ("params", "parameters")
                                for kw in node.keywords
                            )
                            if has_binding:
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
                                        reason="Parameterized SQL query execution with bound parameters",
                                        counted=True,
                                    )
                                )
                            else:
                                # Static query without binding parameters
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
                                        reason="SQL query execution with literal query statement",
                                        counted=True,
                                    )
                                )

                    # Check if query argument is an f-string (FormattedValue) or BinOp (+) -> unsafe
                    elif isinstance(query_arg, (ast.JoinedStr, ast.BinOp)):
                        sig_id = compute_signal_id(
                            self.name, path, line_start, line_end, sha
                        )
                        signals.append(
                            Signal(
                                signal_id=sig_id,
                                detector=self.name,
                                strength=SignalStrength.medium,
                                file_path=path,
                                line_start=line_start,
                                line_end=line_end,
                                snippet=snippet,
                                blob_sha=sha,
                                reason="SQL query executed via string formatting or concatenation (unsafe: potential SQL injection)",
                                counted=True,
                            )
                        )

                # SQLAlchemy select(...) or session.query(...)
                elif method_name in ("select", "query") or (
                    method_name == "execute"
                    and any(isinstance(a, ast.Call) for a in node.args)
                ):
                    line_start = node.lineno
                    line_end = node.end_lineno or line_start
                    snippet = "\n".join(lines[line_start - 1 : line_end])
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
                            reason=f"SQLAlchemy ORM query construction via '{method_name}'",
                            counted=True,
                        )
                    )

        # 5. Check if SQL is only in docstrings (e.g. decoy repo) -> weak signal
        if not signals:
            for node in ast.walk(tree):
                if isinstance(
                    node,
                    (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef, ast.Module),
                ):
                    doc = ast.get_docstring(node)
                    if doc and _SQL_KEYWORDS.search(doc):
                        line_start = getattr(node, "lineno", 1)
                        line_end = getattr(node, "end_lineno", line_start)
                        snippet = "\n".join(
                            lines[line_start - 1 : min(line_end, line_start + 4)]
                        )
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
                                reason="SQL keyword found only inside docstring/comment (decoy)",
                                counted=False,
                            )
                        )
                        break

        return signals
