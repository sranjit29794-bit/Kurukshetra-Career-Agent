"""Deterministic authentication & security detector: JWT, OAuth2, password hashing, and auth dependencies."""
import ast
import re
from typing import List
from backend.app.detectors.base import DetectedSignal, generate_signal_id
from backend.app.schemas import SignalStrength

AUTH_MODULE_KEYWORDS = {"jwt", "oauth2", "bcrypt", "argon2", "passlib", "cryptography", "hmac", "hashlib"}
AUTH_FUNCTION_KEYWORDS = {"create_access_token", "verify_password", "get_password_hash", "decode_token", "get_current_user"}


def detect_auth(file_path: str, content: str, blob_sha: str = "") -> List[DetectedSignal]:
    signals: List[DetectedSignal] = []
    lines = content.splitlines()

    if not file_path.endswith(".py"):
        return signals

    try:
        tree = ast.parse(content)
    except SyntaxError:
        return signals

    # 1. Imports of authentications/crypto packages
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            mod_name = ""
            if isinstance(node, ast.ImportFrom) and node.module:
                mod_name = node.module.lower()
            elif isinstance(node, ast.Import):
                mod_name = node.names[0].name.lower()

            for kw in AUTH_MODULE_KEYWORDS:
                if kw in mod_name:
                    start_l = node.lineno
                    end_l = node.end_lineno or start_l
                    snippet = lines[start_l - 1]
                    sig_id = generate_signal_id("auth", file_path, start_l, end_l, snippet)
                    signals.append(
                        DetectedSignal(
                            signal_id=sig_id,
                            detector="auth",
                            category_key="auth",
                            file_path=file_path,
                            line_start=start_l,
                            line_end=end_l,
                            snippet=snippet,
                            blob_sha=blob_sha,
                            strength=SignalStrength.MEDIUM,
                            counted=True,
                            why=f"Authentication/security module import: `{mod_name}`",
                        )
                    )
                    break

        # 2. Authentication functions or security dependencies
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            lower_name = node.name.lower()
            if any(kw in lower_name for kw in AUTH_FUNCTION_KEYWORDS) or "auth" in lower_name or "login" in lower_name:
                start_l = node.lineno
                end_l = min(node.end_lineno or start_l, start_l + 6)
                snippet = "\n".join(lines[start_l - 1:end_l])
                sig_id = generate_signal_id("auth", file_path, start_l, end_l, snippet)
                signals.append(
                    DetectedSignal(
                        signal_id=sig_id,
                        detector="auth",
                        category_key="auth",
                        file_path=file_path,
                        line_start=start_l,
                        line_end=end_l,
                        snippet=snippet,
                        blob_sha=blob_sha,
                        strength=SignalStrength.STRONG,
                        counted=True,
                        why=f"Authentication security handler function `{node.name}`",
                    )
                )

    return signals
