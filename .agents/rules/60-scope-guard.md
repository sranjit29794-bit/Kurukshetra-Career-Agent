---
trigger: always_on
---

   - Edit only the paths named in the current phase prompt. Never touch other lanes' paths (see docs/PLAN-5H.md §4).
   - Contract files (schemas.py, models.py, docs/fixtures) change only in phase R0, or via a proposal in docs/CONTRACT-DELTA.md that the human approves.
   - No dependencies beyond BRAIN §7.1/§7.2 plus pypdf and psycopg[binary] without asking.
   - Commits: one per slice. Format: be(...) / engine(...) / ingest(...) / fe(...).