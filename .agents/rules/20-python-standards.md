---
trigger: always_on
---

- Python 3.11+, type hints everywhere, Pydantic v2 models for every agent input/output. No Any in public signatures.
- Agents = plain classes with `async def run(self, input: X) -> Y` and `emit(agent, message, level)` for the Agent Activity feed. No LangChain/LangGraph/CrewAI.
- Detectors: pure functions/classes over (path, content) -> list[Signal]. Deterministic, no network, no randomness, no clock.
- `signal_id` = stable hash of (detector, path, line_start, line_end, blob_sha). Same input -> same id.
- Use stdlib `ast` (never regex alone) for Python code semantics; regex only for config/text files. Wrap `ast.parse` in try/except SyntaxError -> return weak/no signals, never crash.
- All prompts live in `backend/app/llm/prompts.py` as versioned constants. No inline prompts elsewhere.
- No secrets in code. Read config via pydantic-settings. Run `ruff check` + `ruff format` before reporting done.