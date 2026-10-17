"""Deterministic AST & syntax-aware detector for Python Language Foundations.

Detects structured OOP class definitions, modern type annotations, and core
Python architecture constructs (Pydantic schemas, Dataclasses, TypeVar, Generics).
"""
import ast
from typing import List
from backend.app.detectors.base import DetectedSignal, generate_signal_id
from backend.app.schemas import SignalStrength


def detect_python(file_path: str, content: str, blob_sha: str = "") -> List[DetectedSignal]:
    """Analyzes Python source for structured OOP classes and typing patterns."""
    signals: List[DetectedSignal] = []
    lines = content.splitlines()

    if not file_path.endswith(".py"):
        return signals

    try:
        tree = ast.parse(content)
    except SyntaxError:
        return signals

    for node in ast.walk(tree):
        # 1. OOP Class Definitions
        if isinstance(node, ast.ClassDef):
            # Check for non-empty operational body (Weak-signal immunity!)
            body_nodes = [
                b for b in node.body
                if not (isinstance(b, ast.Expr) and isinstance(b.value, ast.Constant))
            ]
            is_empty = len(body_nodes) == 0 or (len(body_nodes) == 1 and isinstance(body_nodes[0], ast.Pass))

            has_methods = any(isinstance(b, (ast.FunctionDef, ast.AsyncFunctionDef)) for b in body_nodes)
            has_typed_fields = any(isinstance(b, ast.AnnAssign) for b in body_nodes)

            start_l = node.lineno
            end_l = min(node.end_lineno or start_l, start_l + 5)
            snippet = "\n".join(lines[start_l - 1:end_l])

            if is_empty:
                strength = SignalStrength.WEAK
                counted = False
                limitation = "Stub class with no methods or operational attributes"
            elif has_methods and has_typed_fields:
                strength = SignalStrength.STRONG
                counted = True
                limitation = None
            elif has_methods or has_typed_fields:
                strength = SignalStrength.STRONG
                counted = True
                limitation = None
            else:
                strength = SignalStrength.MEDIUM
                counted = True
                limitation = "Class contains attributes but no behavioral methods"

            sig_id = generate_signal_id("python", file_path, start_l, end_l, snippet)
            signals.append(
                DetectedSignal(
                    signal_id=sig_id,
                    detector="python",
                    category_key="python",
                    file_path=file_path,
                    line_start=start_l,
                    line_end=end_l,
                    snippet=snippet,
                    blob_sha=blob_sha,
                    strength=strength,
                    counted=counted,
                    why=f"Python class definition `{node.name}` with structured OOP constructs",
                    limitation=limitation,
                )
            )

        # 2. Modern Type-Annotated Function Definitions
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            # Check if function has explicit argument type annotations or return annotation
            has_arg_types = any(arg.annotation is not None for arg in node.args.args if arg.arg != "self")
            has_return_type = node.returns is not None

            if has_arg_types and has_return_type:
                start_l = node.lineno
                end_l = min(node.end_lineno or start_l, start_l + 3)
                snippet = "\n".join(lines[start_l - 1:end_l])

                # Check if body is empty pass or docstring only
                body_nodes = [
                    b for b in node.body
                    if not (isinstance(b, ast.Expr) and isinstance(b.value, ast.Constant))
                ]
                is_empty = len(body_nodes) == 0 or (len(body_nodes) == 1 and isinstance(body_nodes[0], ast.Pass))

                if not is_empty:
                    sig_id = generate_signal_id("python", file_path, start_l, end_l, snippet)
                    signals.append(
                        DetectedSignal(
                            signal_id=sig_id,
                            detector="python",
                            category_key="python",
                            file_path=file_path,
                            line_start=start_l,
                            line_end=end_l,
                            snippet=snippet,
                            blob_sha=blob_sha,
                            strength=SignalStrength.STRONG,
                            counted=True,
                            why=f"Type-annotated function `{node.name}` with explicit signature typing",
                            limitation=None,
                        )
                    )

    return signals
