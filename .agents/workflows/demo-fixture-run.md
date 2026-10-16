---
description:  Run the engine on demo repo commits C0, C1, C2 and print a status table
---

1. Run `python -m backend.app.engine_cli --fixture c0`, then `c1`, then `c2` (LLM mocked or `LLM_ENABLED=false` unless the user says otherwise).
2. Print per requirement: status, strength, cited paths+lines, ignored signals.
3. Compare to BRAIN §19.1 expected: REST ✓ unchanged · SQL ○→✓ at C2 · Testing ○→◐ at C2 · Deployment ○ · Python ✓ · C1 (README only) = no upgrade.
4. Any mismatch = bug: write a failing test, fix, rerun.