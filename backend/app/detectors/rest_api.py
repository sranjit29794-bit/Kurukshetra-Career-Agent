"""Deterministic AST & syntax-aware detector for REST/API routes in Python."""
import ast
import re
from typing import List
from backend.app.detectors.base import DetectedSignal, generate_signal_id
from backend.app.schemas import SignalStrength

HTTP_METHODS = {"get", "post", "put", "delete", "patch", "options", "head"}


def detect_rest_api(file_path: str, content: str, blob_sha: str = "") -> List[DetectedSignal]:
    signals: List[DetectedSignal] = []
    lines = content.splitlines()

    if not file_path.endswith(".py"):
        return signals

    try:
        tree = ast.parse(content)
    except SyntaxError:
        # Fallback to regex line matching if file has partial syntax
        for idx, line in enumerate(lines, 1):
            if re.search(r"@\w+\.(get|post|put|delete|patch|route)\(", line, re.IGNORECASE):
                sig_id = generate_signal_id("rest_api", file_path, idx, idx, line)
                signals.append(
                    DetectedSignal(
                        signal_id=sig_id,
                        detector="rest_api",
                        category_key="rest_api",
                        file_path=file_path,
                        line_start=idx,
                        line_end=idx,
                        snippet=line.strip(),
                        blob_sha=blob_sha,
                        strength=SignalStrength.MEDIUM,
                        counted=True,
                        why=f"Regex match for HTTP endpoint decorator: `{line.strip()}`",
                        limitation="Derived via regex fallback due to syntax parse limit.",
                    )
                )
        return signals

    for node in ast.walk(tree):
        # Look for function definitions with HTTP decorators (FastAPI, Flask, Django Ninja/DRF)
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for decorator in node.decorator_list:
                decorator_str = ""
                method_name = ""

                # Pattern: @app.get("/path") or @router.post("/items")
                if isinstance(decorator, ast.Call) and isinstance(decorator.func, ast.Attribute):
                    attr_name = decorator.func.attr.lower()
                    if attr_name in HTTP_METHODS or attr_name == "route":
                        method_name = attr_name.upper()
                        decorator_str = ast.unparse(decorator) if hasattr(ast, "unparse") else attr_name

                # Pattern: @route or @api_view(["GET"])
                elif isinstance(decorator, ast.Call) and isinstance(decorator.func, ast.Name):
                    if decorator.func.id in ("route", "api_view"):
                        method_name = "API_VIEW"
                        decorator_str = ast.unparse(decorator) if hasattr(ast, "unparse") else decorator.func.id

                if method_name:
                    start_l = node.lineno
                    # Take snippet around the function header (decorator + def line)
                    end_l = min(node.end_lineno or start_l, start_l + 4)
                    snippet = "\n".join(lines[start_l - 1:end_l])

                    # Check for empty/pass/docstring-only function (Weak-signal immunity!)
                    body_nodes = [b for b in node.body if not (isinstance(b, ast.Expr) and isinstance(b.value, ast.Constant))]
                    is_empty = len(body_nodes) == 0 or (len(body_nodes) == 1 and isinstance(body_nodes[0], ast.Pass))

                    strength = SignalStrength.WEAK if is_empty else SignalStrength.STRONG
                    counted = not is_empty
                    limitation = "Stub function with no operational body (pass or docstring only)" if is_empty else None

                    sig_id = generate_signal_id("rest_api", file_path, start_l, end_l, snippet)
                    signals.append(
                        DetectedSignal(
                            signal_id=sig_id,
                            detector="rest_api",
                            category_key="rest_api",
                            file_path=file_path,
                            line_start=start_l,
                            line_end=end_l,
                            snippet=snippet,
                            blob_sha=blob_sha,
                            strength=strength,
                            counted=counted,
                            why=f"REST endpoint definition `{node.name}` with decorator `{decorator_str}`",
                            limitation=limitation,
                        )
                    )

    return signals
