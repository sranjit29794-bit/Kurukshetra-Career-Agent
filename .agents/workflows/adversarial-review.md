---
description: Red-team the current work against BRAIN §3 and §17
---

Act as a hostile judge. For the code changed in this phase:
1. Try to make a skill reach DEMONSTRATED using only weak signals (comments, README, pass-only functions, assert True, deps-only). Write each attempt as a failing test first; if it passes the wrong way, fix the code.
2. Try prompt injection via a repo file/comment and a job description. Confirm status never changes and the feed shows "ignored embedded instruction".
3. Try to make the LLM cite a nonexistent signal_id or invent a path/line. Confirm the Verifier drops it.
4. Try malformed LLM JSON, timeout, and provider down. Confirm deterministic fallback and ai_used=false.
5. Report findings as: Attack | Result | Fix | Test name.