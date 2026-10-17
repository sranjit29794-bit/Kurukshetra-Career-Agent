"""Deterministic SQL & database detector: ORM models, migrations, parameterized queries."""
import ast
import re
from typing import List
from backend.app.detectors.base import DetectedSignal, generate_signal_id
from backend.app.schemas import SignalStrength

ORM_BASE_CLASSES = {"base", "model", "declarativebase", "document"}
DB_CALL_METHODS = {"execute", "executemany", "query", "filter_by", "filter", "select"}


def detect_sql_database(file_path: str, content: str, blob_sha: str = "") -> List[DetectedSignal]:
    signals: List[DetectedSignal] = []
    lines = content.splitlines()

    # Case 1: Raw SQL schema / migration files
    if file_path.endswith(".sql"):
        for idx, line in enumerate(lines, 1):
            if re.search(r"CREATE\s+TABLE\s+[a-zA-Z0-9_]+", line, re.IGNORECASE):
                snippet = "\n".join(lines[idx - 1:min(len(lines), idx + 5)])
                sig_id = generate_signal_id("sql_database", file_path, idx, idx + 5, snippet)
                signals.append(
                    DetectedSignal(
                        signal_id=sig_id,
                        detector="sql_database",
                        category_key="sql_database",
                        file_path=file_path,
                        line_start=idx,
                        line_end=min(len(lines), idx + 5),
                        snippet=snippet,
                        blob_sha=blob_sha,
                        strength=SignalStrength.STRONG,
                        counted=True,
                        why=f"SQL DDL table definition: `{line.strip()}`",
                    )
                )
        return signals

    if not file_path.endswith(".py"):
        return signals

    try:
        tree = ast.parse(content)
    except SyntaxError:
        # Fallback to regex line search
        for idx, line in enumerate(lines, 1):
            if re.search(r"\b(SELECT|INSERT|UPDATE|DELETE)\s+.*\bFROM\b", line, re.IGNORECASE):
                sig_id = generate_signal_id("sql_database", file_path, idx, idx, line)
                signals.append(
                    DetectedSignal(
                        signal_id=sig_id,
                        detector="sql_database",
                        category_key="sql_database",
                        file_path=file_path,
                        line_start=idx,
                        line_end=idx,
                        snippet=line.strip(),
                        blob_sha=blob_sha,
                        strength=SignalStrength.MEDIUM,
                        counted=True,
                        why=f"SQL query string found: `{line.strip()}`",
                    )
                )
        return signals

    for node in ast.walk(tree):
        # 1. ORM Class definition (SQLAlchemy / Tortoise / Peewee / Django)
        if isinstance(node, ast.ClassDef):
            # Look for __tablename__ attribute (standard SQLAlchemy)
            has_tablename = any(
                isinstance(stmt, ast.Assign)
                and any(isinstance(target, ast.Name) and target.id == "__tablename__" for target in stmt.targets)
                for stmt in node.body
            )

            is_orm = False
            for base in node.bases:
                base_name = ""
                if isinstance(base, ast.Name):
                    base_name = base.id.lower()
                elif isinstance(base, ast.Attribute):
                    base_name = base.attr.lower()

                # Explicitly exclude Pydantic schemas (BaseModel) which are validation schemas, not SQL ORM models
                if "basemodel" in base_name:
                    continue

                if base_name in ORM_BASE_CLASSES:
                    is_orm = True
                    break

            if (is_orm and not any("basemodel" in getattr(b, "id", getattr(b, "attr", "")).lower() for b in node.bases)) or has_tablename:
                start_l = node.lineno
                end_l = min(node.end_lineno or start_l, start_l + 8)
                snippet = "\n".join(lines[start_l - 1:end_l])
                sig_id = generate_signal_id("sql_database", file_path, start_l, end_l, snippet)
                signals.append(
                    DetectedSignal(
                        signal_id=sig_id,
                        detector="sql_database",
                        category_key="sql_database",
                        file_path=file_path,
                        line_start=start_l,
                        line_end=end_l,
                        snippet=snippet,
                        blob_sha=blob_sha,
                        strength=SignalStrength.STRONG,
                        counted=True,
                        why=f"Relational ORM model class `{node.name}`",
                    )
                )

        # 2. Database query execution (e.g. session.execute(query), db.query(Model))
        elif isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            if node.func.attr.lower() in DB_CALL_METHODS:
                start_l = node.lineno
                end_l = node.end_lineno or start_l
                snippet = "\n".join(lines[start_l - 1:end_l])
                sig_id = generate_signal_id("sql_database", file_path, start_l, end_l, snippet)
                signals.append(
                    DetectedSignal(
                        signal_id=sig_id,
                        detector="sql_database",
                        category_key="sql_database",
                        file_path=file_path,
                        line_start=start_l,
                        line_end=end_l,
                        snippet=snippet,
                        blob_sha=blob_sha,
                        strength=SignalStrength.STRONG,
                        counted=True,
                        why=f"Database execution call: `{node.func.attr}`",
                    )
                )

    return signals
