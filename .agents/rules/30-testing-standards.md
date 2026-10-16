---
trigger: always_on
---

- pytest. Each detector needs 3 test classes: POSITIVE (strong), WEAK (must NOT count), NEGATIVE (nothing). Name tests `test_<detector>_<case>`.
- Tests use fixture repos under `backend/tests/fixtures/repos/<name>/<commit>/...` as in-memory file dicts (path -> content). No network in unit tests. LLM calls mocked.
- Mandatory regression tests from BRAIN §17: README-claims-PostgreSQL, `assert True` test, README-only commit, deleted evidence file, injection text in repo file, LLM invalid JSON, LLM down, non-Python repo.
- A phase is not done until `pytest backend/tests/engine -q` is green and `ruff check` is clean. Paste the summary line in the phase report.
- Never weaken or delete a failing test to pass; fix the code or raise the contradiction.