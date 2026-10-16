"""Smoke test script for validating OpenAI-compatible LLM provider connectivity.

Reference: docs/BRAIN.md (§7.1, §12).
"""

import sys
from pathlib import Path

# Add project root to sys.path to allow running directly
project_root = Path(__file__).resolve().parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from openai import OpenAI

from backend.app.config import Settings

backend_env_path = Path(__file__).resolve().parent.parent / ".env"
settings = (
    Settings(_env_file=str(backend_env_path))
    if backend_env_path.exists()
    else Settings()
)


def run_smoke_llm() -> bool:
    """Validate LLM endpoint and credentials, printing OK or FAIL."""
    print("--- DevProof LLM Smoke Test ---")
    print(f"Base URL: {settings.LLM_BASE_URL}")
    print(f"Model:    {settings.LLM_MODEL}")
    print(f"Enabled:  {settings.LLM_ENABLED}")

    if not settings.LLM_ENABLED:
        print("[LLM] OK: LLM is disabled (deterministic mode active)")
        return True

    if not settings.LLM_API_KEY:
        print("[LLM] FAIL: LLM_API_KEY is not set in environment or .env")
        return False

    try:
        client = OpenAI(
            base_url=settings.LLM_BASE_URL,
            api_key=settings.LLM_API_KEY,
            timeout=float(settings.LLM_TIMEOUT_S),
        )
        response = client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=[{"role": "user", "content": "Reply with 'OK'"}],
            max_tokens=10,
            temperature=0.0,
        )
        content = response.choices[0].message.content or ""
        print(f"[LLM] OK: Response received: {content.strip()}")
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"[LLM] FAIL: Request failed with error: {exc}")
        return False


if __name__ == "__main__":
    success = run_smoke_llm()
    sys.exit(0 if success else 1)
