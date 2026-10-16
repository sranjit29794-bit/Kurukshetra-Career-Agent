"""REST API proficiency detector.

Reference: docs/BRAIN.md (§11).
Strong signal:
  - FastAPI: @app.get/post/put/delete/patch, @router.* bound to a handler with a non-trivial body.
  - Flask: @app.route
  - Django: path() / re_path() in urlpatterns
  - Bonus: Pydantic request models
Medium signal: single route / stub handler
Weak signal: route in comment/README, handler body pass
"""

from __future__ import annotations

import ast
import re

from backend.app.detectors.base import BaseDetector, compute_blob_sha, compute_signal_id
from backend.app.detectors.weak_signals import is_empty_or_pass_only, is_readme_or_doc
from backend.app.schemas import Signal, SignalStrength

_ROUTE_METHODS = {
    "get",
    "post",
    "put",
    "delete",
    "patch",
    "options",
    "head",
    "api_route",
}


class RestApiDetector(BaseDetector):
    """Detector for REST API development skills."""

    name: str = "rest_api"

    def _is_route_decorator(self, decorator: ast.expr) -> tuple[bool, str]:
        """Check if an AST decorator corresponds to a REST route handler."""
        # @app.get(...), @router.post(...)
        if isinstance(decorator, ast.Call) and isinstance(
            decorator.func, ast.Attribute
        ):
            attr_name = decorator.func.attr.lower()
            if attr_name in _ROUTE_METHODS or attr_name == "route":
                return True, attr_name

        # Plain attribute: @app.get
        if isinstance(decorator, ast.Attribute):
            attr_name = decorator.attr.lower()
            if attr_name in _ROUTE_METHODS or attr_name == "route":
                return True, attr_name

        return False, ""

    def detect(
        self,
        path: str,
        content: str,
        blob_sha: str | None = None,
        all_files: dict[str, str] | None = None,
    ) -> list[Signal]:
        """Detect REST API routes and endpoints."""
        sha = blob_sha or compute_blob_sha(content)
        signals: list[Signal] = []
        lines = content.splitlines()

        # 1. README / Doc check: mention of REST/API in docs is always WEAK
        if is_readme_or_doc(path):
            if re.search(
                r"\b(rest|restful|api|fastapi|flask|endpoints)\b",
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
                        reason="README or documentation claims REST API without verified code",
                        counted=False,
                    )
                )
            return signals

        if not path.endswith(".py"):
            return []

        try:
            tree = ast.parse(content, filename=path)
        except SyntaxError:
            return []

        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                for deco in node.decorator_list:
                    is_route, method = self._is_route_decorator(deco)
                    if is_route:
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
                                    reason=f"Route handler '{node.name}' has empty or pass-only body",
                                    counted=False,
                                )
                            )
                        else:
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
                                    reason=f"Active REST endpoint handler '{node.name}' with HTTP {method.upper()}",
                                    counted=True,
                                )
                            )

        return signals
