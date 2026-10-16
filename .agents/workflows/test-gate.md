---
description: Run the quality gate for the current phase and report pass/fail
---

Backend phases:
1. `ruff check backend && ruff format --check backend`
2. `pytest backend/tests/engine -q` (add `-k <phase keyword>` if the user gave one)
3. Run invariant scan: grep the changed files for forbidden patterns: `exec(`, `eval(`, `subprocess`, `importlib` on repo content; hardcoded keys; prompts outside llm/prompts.py.
Frontend phases:
1. `cd frontend && npx tsc --noEmit && npm run build`
2. Launch with `VITE_USE_FIXTURES=1` and list which screens/states you verified.
Report: table of checks PASS/FAIL, first failing output, and the exact fix applied. Do not mark done unless all PASS.