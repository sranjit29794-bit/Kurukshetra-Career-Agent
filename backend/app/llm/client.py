"""OpenAI-compatible LLM client with schema validation, retry, caching, and auto-degradation.

Reference: docs/BRAIN.md (§7.1, §12) and rule 40-llm-safety.md.

Hard Invariants:
1. Respects LLM_ENABLED and auto-degrades after 2 consecutive provider errors.
2. Single wrapper complete_json(system, user, schema) validating Pydantic models.
3. Performs one repair re-ask on schema validation failure before raising.
4. In-memory cache keyed by input SHA-256 hash.
5. Deterministic fallback mode is always preserved (ai_used=false).
"""

from __future__ import annotations

import contextlib
import hashlib
import json
import logging
from typing import TypeVar

import httpx
from openai import (
    APIConnectionError,
    APIStatusError,
    AsyncOpenAI,
    InternalServerError,
    RateLimitError,
)
from pydantic import BaseModel, ValidationError
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from backend.app.config import settings
from backend.app.events import event_bus

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


class LLMError(Exception):
    """Base exception for LLM operations."""


class LLMDisabledError(LLMError):
    """Raised when LLM is explicitly disabled or unconfigured."""


class LLMDegradedError(LLMError):
    """Raised when LLM is automatically degraded to deterministic mode due to consecutive errors."""


class LLMValidationError(LLMError):
    """Raised when response fails schema validation after repair attempt."""


class LLMClient:
    """Async OpenAI-compatible LLM wrapper adhering to DevProof safety and reliability invariants."""

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        primary_model: str | None = None,
        fallback_model: str | None = None,
        timeout_s: float | None = None,
        enabled: bool | None = None,
    ) -> None:
        self.base_url = base_url if base_url is not None else settings.LLM_BASE_URL
        self.api_key = api_key if api_key is not None else settings.LLM_API_KEY
        self.primary_model = (
            primary_model if primary_model is not None else settings.LLM_MODEL
        )
        self.fallback_model = (
            fallback_model
            if fallback_model is not None
            else settings.LLM_FALLBACK_MODEL
        )
        self.timeout_s = (
            timeout_s if timeout_s is not None else float(settings.LLM_TIMEOUT_S)
        )
        self.enabled = enabled if enabled is not None else settings.LLM_ENABLED

        # Circuit breaker state
        self.consecutive_errors: int = 0
        self.is_degraded: bool = False

        # In-memory response cache: hash -> json_str
        self._cache: dict[str, str] = {}

        # Underlying client instance (lazy)
        self._client: AsyncOpenAI | None = None

    def _get_client(self) -> AsyncOpenAI:
        if self._client is None:
            self._client = AsyncOpenAI(
                base_url=self.base_url,
                api_key=self.api_key or "no-key",
                timeout=self.timeout_s,
            )
        return self._client

    def _compute_cache_key(self, model: str, system: str, user: str) -> str:
        data = f"{model}:{system}:{user}".encode()
        return hashlib.sha256(data).hexdigest()

    async def complete_json(
        self,
        system: str,
        user: str,
        schema: type[T],
        track_id: str | None = None,
    ) -> T:
        """Execute JSON completion with caching, retries, and repair on schema failure."""
        if not self.enabled or not self.api_key:
            raise LLMDisabledError("LLM is disabled or API key is not configured")

        if self.is_degraded:
            raise LLMDegradedError(
                "LLM is in degraded state following consecutive provider errors"
            )

        # Check in-memory cache
        cache_key = self._compute_cache_key(self.primary_model, system, user)
        if cache_key in self._cache:
            try:
                return schema.model_validate_json(self._cache[cache_key])
            except ValidationError:
                # Evict corrupted cache entry and re-fetch
                del self._cache[cache_key]

        models_to_try = [self.primary_model]
        if self.fallback_model and self.fallback_model != self.primary_model:
            models_to_try.append(self.fallback_model)

        last_exception: Exception | None = None

        for model in models_to_try:
            try:
                raw_json = await self._call_model_with_retry(model, system, user)
                # Validate against schema
                validated = await self._validate_or_repair(
                    model, system, user, raw_json, schema
                )
                # Success: reset circuit breaker and cache result
                self.consecutive_errors = 0
                self._cache[cache_key] = validated.model_dump_json()
                return validated
            except (LLMValidationError, ValidationError) as val_err:
                # Validation error after repair: do not try next model if it's prompt-specific
                self._record_error("schema_validation_failed", str(val_err), track_id)
                raise LLMValidationError(
                    f"Schema validation failed: {val_err}"
                ) from val_err
            except Exception as err:
                last_exception = err
                logger.warning("LLM model '%s' call failed: %s", model, err)
                continue

        # If all models failed
        self._record_error("provider_error", str(last_exception), track_id)
        raise LLMError(f"All LLM models failed. Last error: {last_exception}")

    async def _call_model_with_retry(self, model: str, system: str, user: str) -> str:
        """Call model with tenacity exponential backoff on transient errors."""
        client = self._get_client()

        retryer = AsyncRetrying(
            stop=stop_after_attempt(2),
            wait=wait_exponential(multiplier=1, min=1, max=3),
            retry=retry_if_exception_type(
                (
                    APIConnectionError,
                    RateLimitError,
                    InternalServerError,
                    APIStatusError,
                    httpx.HTTPError,
                )
            ),
            reraise=True,
        )

        async for attempt in retryer:
            with attempt:
                messages = [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ]
                response = await client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=0.0,
                    response_format={"type": "json_object"},
                )
                choice = response.choices[0]
                content = choice.message.content or "{}"
                return content.strip()

        return "{}"

    async def _validate_or_repair(
        self,
        model: str,
        system: str,
        user: str,
        raw_json: str,
        schema: type[T],
    ) -> T:
        """Attempt Pydantic validation. On failure, execute exactly ONE repair re-ask."""
        try:
            # Strip markdown fences if LLM wrapped json in ```json ... ```
            cleaned = self._strip_markdown_fences(raw_json)
            return schema.model_validate_json(cleaned)
        except (ValidationError, json.JSONDecodeError) as first_err:
            logger.info(
                "First validation failed (%s). Executing repair re-ask.", first_err
            )

            # Repair prompt with expected schema
            schema_json = json.dumps(schema.model_json_schema(), indent=2)
            repair_user = (
                f"{user}\n\n"
                f"CRITICAL: Your previous response was invalid and failed schema validation with error:\n"
                f"{first_err}\n\n"
                f"You MUST return ONLY valid JSON matching this schema:\n"
                f"{schema_json}"
            )

            client = self._get_client()
            repair_response = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": repair_user},
                ],
                temperature=0.0,
                response_format={"type": "json_object"},
            )
            repaired_content = repair_response.choices[0].message.content or "{}"
            cleaned_repaired = self._strip_markdown_fences(repaired_content.strip())
            return schema.model_validate_json(cleaned_repaired)

    def _strip_markdown_fences(self, text: str) -> str:
        """Remove ```json and ``` code block wrappers if present."""
        trimmed = text.strip()
        if trimmed.startswith("```"):
            lines = trimmed.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            return "\n".join(lines).strip()
        return trimmed

    def _record_error(
        self, err_type: str, detail: str, track_id: str | None = None
    ) -> None:
        """Track consecutive errors and trigger auto-degrade after 2 failures."""
        self.consecutive_errors += 1
        if self.consecutive_errors >= 2 and not self.is_degraded:
            self.is_degraded = True
            logger.error(
                "LLM auto-degraded to deterministic mode after %d errors: %s",
                self.consecutive_errors,
                detail,
            )
            # Emit warning event to event bus
            with contextlib.suppress(Exception):
                event_bus.emit(
                    agent="LLMClient",
                    message="LLM auto-degraded to deterministic mode following consecutive errors.",
                    level="warn",
                    track_id=track_id,
                )


# Global singleton instance
llm_client = LLMClient()
