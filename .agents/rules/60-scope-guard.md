---
trigger: always_on
---

- Edit only paths listed in the current phase prompt. Never touch paths outside it.
- Contract changes (schemas.py, docs/fixtures) are allowed only in Phase F0 or when the phase prompt says so.
- No dependencies beyond BRAIN §7.1/§7.2 without asking.
- Commits: one per vertical slice. Format: `fe(<area>): ...` / `be(<area>): ...` / `engine(<area>): ...`.