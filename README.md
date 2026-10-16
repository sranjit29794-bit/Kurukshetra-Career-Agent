# DevProof (Kurukshetra Career Agent)

> **Verifiable Developer Skill Proof & Real-Time Repo Sentinel**  
> Evaluates candidate repositories against real job descriptions using deterministic static analysis, AST signal extraction, and an evidence ladder. No fake percentages, no subjective scores, no code execution.

---

## 1. Core Philosophy & Invariants

DevProof is built on honesty and verifiable proof:
1. **No Evidence -> No Credit**: A skill is only `DEMONSTRATED` if verified, strong AST/static code signals are observed. Unverified claims remain at `E0`.
2. **Four Strict Statuses Only**:
   - `DEMONSTRATED` (Green check): Verified implementation evidence exists.
   - `PARTIALLY DEMONSTRATED` (Amber dot): Evidence observed but capped (e.g. testing/deployment capped at static level).
   - `NOT DEMONSTRATED IN ANALYZED SCOPE` (Slate dashed border, **never red**): Missing evidence means not found in analyzed scope, never that the candidate lacks the skill.
   - `NEEDS MANUAL VERIFICATION` (Purple alert): Citation validation failed or ambiguous signals.
3. **No Readiness Percentages**: No arbitrary 0–100% scores anywhere. Plain requirement counts and evidence citations only.
4. **Untrusted Data Isolation**: Repository code, README text, and job descriptions are fenced untrusted data (`<<<DATA ... DATA>>>`). Candidate code is **NEVER executed** (no `exec`, `eval`, or imports).
5. **Deterministic Foundation**: The app functions 100% without an LLM (`LLM_ENABLED=false`). When enabled, the LLM may only explain or downgrade preliminary status—it can never upgrade past deterministic code signals.
6. **Evidence Ladder**:
   - `E0 Claimed`: README mentions or resume statements.
   - `E1 Present`: Files exist in repository.
   - `E2 Implemented`: Syntactically valid, reachable implementation in AST.
   - `E3 Tested (Static)`: Test suite imports and exercises project code (capped at `PARTIAL`).
   - `E4 CI-Verified`: Upgraded to `DEMONSTRATED` only when a real GitHub `check_run` / `workflow_run` succeeds.
   - `E5 Deployed`: Verified runtime endpoint or deployment descriptor.

---

## 2. Architecture & Components

```
Kurukshetra-Career-Agent/
├── backend/                  # FastAPI + SQLAlchemy 2.x (SQLite WAL)
│   ├── app/
│   │   ├── agents/           # Orchestrator, RepoScout, EvidenceJudge, Verifier, Coach
│   │   ├── detectors/        # AST detectors (Python, REST API, SQL, Testing, Deployment)
│   │   ├── github/           # Async GitHub client with ETag, rate-limit backoff
│   │   ├── llm/              # OpenAI-compatible client, injection shield, cache
│   │   ├── routers/          # health, jobs, resume, repos, tracks, webhooks, events
│   │   └── services/         # impact_map, diff_builder, status_rules, job_extractor
│   └── tests/                # 127 pytest suite (unit, engine, adversarial, integration)
└── frontend/                 # React 18 + TypeScript + Vite + Tailwind CSS + shadcn
    ├── src/
    │   ├── components/       # Wizard, Dashboard, ClaimsMatrix, Results, CodeViewer
    │   ├── hooks/            # useEvents (SSE real-time stream)
    │   └── lib/              # api.ts (unified data layer with error envelope)
```

---

## 3. Quickstart & Setup

### Prerequisites
- Python 3.11+
- Node.js 18+ & npm

### Backend Setup
```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```

### Environment Configuration (`backend/.env`)
| Variable | Default | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `sqlite:///./devproof.db` | SQLite database URL (WAL mode enabled) |
| `LLM_ENABLED` | `false` | Set `true` to enable LLM summary/coach enhancements |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible endpoint (OpenAI, Gemini, etc.) |
| `LLM_API_KEY` | `""` | Provider API key (optional; runs deterministic if empty) |
| `LLM_MODEL` | `gpt-4o-mini` | Model name |
| `GITHUB_TOKEN` | `""` | GitHub Personal Access Token (for higher API rate limit) |
| `GITHUB_WEBHOOK_SECRET` | `devproof_demo_secret_2026` | HMAC-SHA256 secret for webhook validation |
| `POLL_INTERVAL_S` | `10` | Commit polling fallback frequency in seconds |
| `PUBLIC_BASE_URL` | `http://localhost:8000` | Public URL for webhook delivery |

Run backend server:
```bash
uvicorn backend.app.main:app --reload --port 8000
```
Verify health:
```bash
curl http://localhost:8000/api/health
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 4. Webhook Setup & Live Event Sentinel

### Option A: Tunnel Mode (Full Real-Time Webhook Demo)
1. Expose your backend via Cloudflare Tunnel:
   ```bash
   cloudflared tunnel --url http://localhost:8000
   ```
2. Copy the resulting HTTPS URL (e.g., `https://random-subdomain.trycloudflare.com`).
3. Set `PUBLIC_BASE_URL=https://random-subdomain.trycloudflare.com` in `backend/.env`.
4. On your candidate GitHub repository (`Settings -> Webhooks -> Add webhook`):
   - **Payload URL**: `https://random-subdomain.trycloudflare.com/api/webhooks/github`
   - **Content type**: `application/json`
   - **Secret**: Value of `GITHUB_WEBHOOK_SECRET` (`devproof_demo_secret_2026`)
   - **Events**: Select *Pushes*, *Check runs*, and *Workflow runs*.

### Option B: Transparent Polling Mode (Zero Config)
If no public tunnel is available, DevProof automatically runs in **Polling Mode**:
- Every `POLL_INTERVAL_S` (10s), the sentinel checks the default branch HEAD SHA.
- The UI displays `Watcher: Polling (Every 10s)`.
- When a new commit is detected, reassessment triggers automatically with zero user intervention.

---

## 5. Running the Demo & Rehearsal

### Reproducing the Live Demo Flow
The automated integration test simulates the entire end-to-end rehearsal without manual pushes:
```bash
python -m pytest backend/tests/integration/test_full_stack_flow.py -v
```
**Test sequence executed**:
1. Ingests DoorDash job posting (`docs/demo/job_paste.txt`) -> extracts 6 verifiable requirements.
2. Ingests candidate resume (`docs/demo/resume_b.pdf`) -> extracts claimed skills and discovers GitHub repository from PDF hyperlink annotations.
3. Links Job + Repo to create an Opportunity Track.
4. Initial assessment at commit `C0`:
   - REST API: `DEMONSTRATED`
   - SQL Database: `NOT DEMONSTRATED IN ANALYZED SCOPE`
   - Testing: `NOT DEMONSTRATED IN ANALYZED SCOPE`
5. Push commit `C1` (Docs/README claims only):
   - Sentinel flags commit as `docs_only: no skill change`.
   - All requirement statuses remain unchanged (README text alone cannot upgrade a verdict).
6. Push commit `C2` (SQL models + test suite code added):
   - SQL Database flips to `DEMONSTRATED` with line citations.
   - Testing flips to `PARTIALLY DEMONSTRATED` (static analysis cap).
7. GitHub CI `check_run` completion webhook:
   - Automated test suite passes on GitHub Actions.
   - Testing upgrades from `PARTIAL` to `DEMONSTRATED (CI-verified)`.
8. Diff Builder generates the status change transition report (`/api/tracks/{id}/diff`).

### Frontend Offline / Fixture Rehearsal
To run the UI completely disconnected from the backend using pre-computed demo fixtures:
```bash
# In frontend/.env or terminal:
VITE_USE_FIXTURES=1 npm run dev
```

---

## 6. Known Limitations & Scope Boundaries

- **Public Repositories First**: Currently supports public GitHub repositories. Private repos require an OAuth App or GitHub App installation token.
- **Python AST Primary**: Deep AST semantic analysis is currently implemented for Python. Non-Python repositories report "0 supported files analyzed" and return clean `NOT_DEMONSTRATED`.
- **Deployment Verification**: Static deployment analysis (Dockerfile, docker-compose, render.yaml) is capped at `PARTIAL`. Runtime verification requires external probed URLs or cloud provider metadata.
- **Dynamic LLM Models**: When running with third-party free LLM endpoints, models may be discontinued or rate-limited. DevProof seamlessly auto-degrades to deterministic mode (`ai_used=false`).

---

## 7. Testing & Quality Gates

Run all 127 automated tests:
```bash
python -m pytest backend/tests -v
```
Run linter & formatting check:
```bash
python -m ruff check backend
python -m ruff format --check backend
```
Frontend validation:
```bash
cd frontend
npm run lint
npx tsc -b
npm run build
```