<<<<<<< HEAD
# DevProof ⚡
> **Your code. Your proof.**
> Hackathon: Worcflow Agentic AI Track · Problem **W-PS-2: AI Career Coach**

DevProof is a continuously updated, evidence-backed career assessment platform. It reads real job postings, analyzes a developer's real GitHub repositories at a specific commit, validates which required skills the code actually demonstrates with exact file and line citations, and automatically reassesses only impacted skills when new code is pushed.

---

## 🏛️ Phase 0 Repository Foundation

This repository contains the **Phase 0 shared foundation** establishing contracts, database schemas, and verification tooling across all four team members:

| Role | Member Focus | Boundaries |
|---|---|---|
| **Member 1** | Backend & Change Detection | GitHub REST API, Webhooks, Polling Sentinel, Background Watcher |
| **Member 2** | Code Analysis & AI Agents | AST Detectors, LLM Judge, Skeptic Verifier, Coach |
| **Member 3** | Main Application UI | Add Job Wizard, Dashboard, Requirement Cards, Global Shell |
| **Member 4** | Evidence & Comparison UI | Code Viewer, Before/After Diff, Agent Activity Feed, Demo Polish |

---

## 📐 Shared Contract & Source of Truth

The single source of truth for architecture and invariants is [`docs/BRAIN.md`](file:///d:/Projects/Hackathons/KurukshetraDYPPimpri/kurukshetraproj/docs/BRAIN.md).

Typed contracts are defined symmetrically across backend and frontend:
- **Backend Pydantic v2 Models:** [`backend/app/schemas.py`](file:///d:/Projects/Hackathons/KurukshetraDYPPimpri/kurukshetraproj/backend/app/schemas.py)
- **Frontend TypeScript Types:** [`frontend/src/types/contract.ts`](file:///d:/Projects/Hackathons/KurukshetraDYPPimpri/kurukshetraproj/frontend/src/types/contract.ts)
- **Database SQLAlchemy 2.x Models:** [`backend/app/models.py`](file:///d:/Projects/Hackathons/KurukshetraDYPPimpri/kurukshetraproj/backend/app/models.py)
- **JSON Fixtures for Mocking:**
  - `docs/fixtures/job_draft.json`
  - `docs/fixtures/repo_connect.json`
  - `docs/fixtures/assessment.json`
  - `docs/fixtures/diff.json`
  - `docs/fixtures/agent_events.json`

### Fixed Status Enums
- **Assessment Status:** `DEMONSTRATED`, `PARTIAL`, `NOT_DEMONSTRATED`, `UNABLE_TO_ASSESS`
- **Analysis Status:** `queued`, `running`, `complete`, `failed`
- **Trigger:** `manual`, `webhook`, `poll`
- **Source Type:** `fetched`, `user_provided`

---

## 🚀 Quickstart & Setup

### Prerequisites
- **Python:** 3.11+ (Python 3.14 verified)
- **Node.js:** 18+ (Node 24 / npm 11 verified)

### 1. Environment Setup
Copy the example environment configuration:
```bash
cp .env.example .env
```
*(No secrets are committed. For Phase 0, all services run with safe local defaults).*

### 2. Backend Setup
```bash
# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Run database table initialization and verify tests
pytest -v

# Start FastAPI backend
uvicorn backend.app.main:app --reload --port 8000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 🔗 Key Endpoints & Verification URLs

When running locally:
- **API Documentation (Swagger UI):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **OpenAPI Schema:** [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json)
- **Health Check Endpoint:** [http://localhost:8000/api/health](http://localhost:8000/api/health)
- **Dev Contracts Endpoint:** [http://localhost:8000/api/dev/contracts](http://localhost:8000/api/dev/contracts)
- **Developer Verification Screen:** [http://localhost:5173/devtools](http://localhost:5173/devtools)
- **Frontend App Shell:** [http://localhost:5173/](http://localhost:5173/)

---

## 🧪 Running Tests

Run the backend test suite:
```bash
pytest -v
```
Included test coverage:
- `test_health.py`: Live health endpoint validation and structured error responses.
- `test_schemas.py`: Validation of all JSON fixtures against Pydantic models.
- `test_db.py`: SQLAlchemy table creation and unique constraint idempotency protection `(track_id, commit_sha)`.

---

## 🛡️ Invariants Enforced in Phase 0
1. **No Evidence → No Credit:** Assessment status requires verified strong signal citations.
2. **Deterministic Fallbacks & Honest Health:** Integration failures or unconfigured tokens report `unconfigured` / `disabled`, never false positives.
3. **Consistent Error Shape:** All API errors return `{ "error": { "code", "message", "retryable" } }`.
4. **Idempotent Analysis Constraint:** Enforced in database schema: unique analysis per `(track_id, commit_sha)`.
5. **Fixture Separation:** Developer verification tools at `/devtools` explicitly tag fixture data with `FIXTURE / MOCK DATA`.
=======
# Kurukshetra-Career-Agent
>>>>>>> origin/main
