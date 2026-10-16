# DevProof System State Audit

Audit generated autonomously on branch `feature/ranjit`.
Local timestamp: 2026-10-17.

## 1. Phase Status Matrix

| Phase | Description | Status | Evidence / Files | Passing Tests |
|---|---|---|---|---|
| **R0** | Contract delta, DB factory, engine stub, scaffold | **DONE** | `backend/app/schemas.py`, `models.py`, `db.py`, `engine_stub.py`, `main.py` | 12 tests in `backend/tests/` |
| **BE-1** | Backend foundation (GitHub client, file filter, repo scout, routers) | **MISSING** | Stubs in `routers/{health,repos,tracks,github_users,evidence}.py`; needs `github/client.py`, `github/files.py`, `agents/repo_scout.py` | 0 tests |
| **EN-1** | Detectors & status rules (Python, REST, SQL, testing, deployment) | **MISSING** | Need `detectors/`, `services/status_rules.py`, fixture tests | 0 tests |
| **IN-1** | LLM layer (OpenAI-compatible client, prompts, fallback, safety) | **MISSING** | Need `llm/client.py`, `prompts.py`, `fallback.py`, `smoke_llm.py` | 0 tests |
| **IN-2** | Job ingestion (Greenhouse, Lever, JSON-LD, paste fallback, SSRF) | **MISSING** | Need `agents/job_analyst.py`, `ingest/jobs/`, `routers/jobs.py` | 0 tests |
| **IN-3** | Resume ingestion (PDF parse, hyperlink annotations, claims, warnings) | **MISSING** | Need `agents/resume_analyst.py`, `ingest/resume/`, `routers/resume.py` | 0 tests |
| **BE-2** | Orchestrator, watcher, impact map, diffing, webhook, poller, SSE | **MISSING** | Need `agents/orchestrator.py`, `change_sentinel.py`, `services/impact_map.py`, `diffing.py` | 0 tests |
| **EN-2** | Evidence analyst, verifier, coach, engine facade | **MISSING** | Need `agents/evidence_analyst.py`, `verifier.py`, `coach.py`, `engine.py` | 0 tests |
| **FE** | Frontend improvements (Wizard resume step, claims matrix, live SSE, honest UI) | **PARTIAL** | Pages & components built on fixtures; needs resume step, claims view, real API wiring | Typecheck & build pass |
| **G / Int** | Full stack integration & Playwright E2E gate | **MISSING** | Need full stack real execution against demo repo | 0 tests |
| **H / Hardening** | Real pushes, webhooks, edge cases, adversarial review | **MISSING** | Need C1/C2 real loop & BRAIN §17 verification | 0 tests |
| **I / Docs** | Docs, demo script, README, rehearsal runs | **MISSING** | Need README, demo script, screenshots | 0 tests |

## 2. LLM Provider Configuration

- **Provider**: Google Gemini (OpenAI-compatible API endpoint) / OpenAI compatible
- **Base URL**: `https://generativelanguage.googleapis.com/v1beta/openai/` (verified OpenAI-compatible endpoint)
- **Fallback / Alternate Model**: `gemini-1.5-flash` or `gemini-2.5-flash`
- **Current Mode**: `LLM_ENABLED=false` supported as first-class deterministic mode. Deterministic status matching ensures identical verdicts whether LLM is on or off.

## 3. Demo Links & Repositories (from `docs/demo/my-links.txt`)
- **Demo Repo**: `https://github.com/sranjit29794-bit/student-api`
- **External Public Repo**: `https://github.com/miguelgrinberg/microblog`
- **Greenhouse Link**: `https://job-boards.greenhouse.io/doordashusa/jobs/8171041`
- **LinkedIn Link**: `https://www.linkedin.com/jobs/view/4478865041/` (Login wall expected -> triggers user paste fallback)
- **Paste Text File**: `docs/demo/job_paste.txt`
