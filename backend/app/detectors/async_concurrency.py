"""Deterministic async & concurrency detector: asyncio, async def, await, task primitives."""
import ast
from typing import List
from backend.app.detectors.base import DetectedSignal, generate_signal_id
from backend.app.schemas import SignalStrength


def detect_async_concurrency(file_path: str, content: str, blob_sha: str = "") -> List[DetectedSignal]:
    signals: List[DetectedSignal] = []
    lines = content.splitlines()

    if not file_path.endswith(".py"):
        return signals

    try:
        tree = ast.parse(content)
    except SyntaxError:
        return signals

    for node in ast.walk(tree):
        # 1. Async function definition with awaited calls
        if isinstance(node, ast.AsyncFunctionDef):
            has_await = any(isinstance(n, ast.Await) for n in ast.walk(node))
            start_l = node.lineno
            end_l = min(node.end_lineno or start_l, start_l + 6)
            snippet = "\n".join(lines[start_l - 1:end_l])

            strength = SignalStrength.STRONG if has_await else SignalStrength.MEDIUM
            why = f"Asynchronous function `{node.name}` with awaited operations" if has_await else f"Asynchronous function signature `{node.name}`"

            sig_id = generate_signal_id("async_concurrency", file_path, start_l, end_l, snippet)
            signals.append(
                DetectedSignal(
                    signal_id=sig_id,
                    detector="async_concurrency",
                    category_key="async_concurrency",
                    file_path=file_path,
                    line_start=start_l,
                    line_end=end_l,
                    snippet=snippet,
                    blob_sha=blob_sha,
                    strength=strength,
                    counted=True,
                    why=why,
                )
            )

        # 2. Direct asyncio usage (asyncio.gather, asyncio.create_task)
        elif isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            if isinstance(node.func.value, ast.Name) and node.func.value.id == "asyncio":
                start_l = node.lineno
                end_l = node.end_lineno or start_l
                snippet = "\n".join(lines[start_l - 1:end_l])
                sig_id = generate_signal_id("async_concurrency", file_path, start_l, end_l, snippet)
                signals.append(
                    DetectedSignal(
                        signal_id=sig_id,
                        detector="async_concurrency",
                        category_key="async_concurrency",
                        file_path=file_path,
                        line_start=start_l,
                        line_end=end_l,
                        snippet=snippet,
                        blob_sha=blob_sha,
                        strength=SignalStrength.STRONG,
                        counted=True,
                        why=f"Asyncio concurrency primitive call: `asyncio.{node.func.attr}`",
                    )
                )

    return signals
