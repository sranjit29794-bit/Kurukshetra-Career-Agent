---
trigger: always_on
---

# Source of truth
- `docs/BRAIN.md` is authoritative. Re-read the sections relevant to the current phase before coding (cite the § numbers you used in your plan).
- If BRAIN.md is ambiguous, infeasible, or contradicts the task: STOP and ask with a 2-line proposal. Never silently redesign.
- Respect §0.1 CURRENT_PRIORITY. P1 only unless the human writes START P2. P3 never.
- Follow the Priority Gate Protocol (§0.2): when a phase's exit checks pass, print a pass/fail checklist and STOP. Do not start the next phase.
- Skills: at the start of each phase, check the available skills list and use every skill that matches the work (python/testing/security-review/frontend/code-review etc.). State which skills you used in the phase report. If none match, say so and proceed.

- Context7: before using any library API (FastAPI lifespan, SQLAlchemy 2.x, sse-starlette, openai SDK, trafilatura, TanStack Query, react-router, shadcn, react-syntax-highlighter), check current docs via Context7. Don't code from memory.
- Design skills (Impeccable, Taste, UI/UX Pro Max, Huashu) refine within BRAIN §16.1 tokens. They never override them. Not-demonstrated is never red, and there is no readiness %.