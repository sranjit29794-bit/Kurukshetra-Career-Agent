"""LLM integration module for DevProof.

Reference: docs/BRAIN.md (§7.1, §12) and rule 40-llm-safety.md.
"""

from backend.app.llm.client import (
    LLMClient,
    LLMDegradedError,
    LLMDisabledError,
    LLMError,
    LLMValidationError,
    llm_client,
)
from backend.app.llm.fallback import (
    generate_deterministic_explanation,
    generate_deterministic_limitations,
    generate_deterministic_next_steps,
)
from backend.app.llm.prompts import (
    INJECTION_REGEX,
    PROMPT_EXPLAIN_DIFF_V1,
    PROMPT_EXTRACT_REQUIREMENTS_V1,
    PROMPT_JUDGE_EVIDENCE_V1,
    SYSTEM_INJECTION_SHIELD,
    wrap_untrusted,
)

__all__ = [
    "INJECTION_REGEX",
    "PROMPT_EXPLAIN_DIFF_V1",
    "PROMPT_EXTRACT_REQUIREMENTS_V1",
    "PROMPT_JUDGE_EVIDENCE_V1",
    "SYSTEM_INJECTION_SHIELD",
    "LLMClient",
    "LLMDegradedError",
    "LLMDisabledError",
    "LLMError",
    "LLMValidationError",
    "generate_deterministic_explanation",
    "generate_deterministic_limitations",
    "generate_deterministic_next_steps",
    "llm_client",
    "wrap_untrusted",
]
