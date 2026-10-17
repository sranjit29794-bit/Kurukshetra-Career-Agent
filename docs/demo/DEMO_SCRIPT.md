# DevProof: 5-Minute Live Demo Script & Rehearsal Guide

> **Target Audience**: Technical judges, engineering hiring managers, recruiters.  
> **Key Message**: *DevProof replaces subjective resumes and self-reported skills with verifiable, commit-level AST code proof and real-time GitHub sentinel monitoring.*

---

## Pre-Demo Checklist (T-5 Minutes)

- [ ] **Backend Running**: `uvicorn backend.app.main:app --port 8000` (check `http://localhost:8000/api/health`).
- [ ] **Frontend Running**: `npm run dev` at `http://localhost:5173`.
- [ ] **Demo Links Ready**: Open `docs/demo/my-links.txt` for quick reference.
- [ ] **Demo Repository Clean**: Ensure `DEMO_REPO` is reset to commit `C0` (or prepare to use simulated webhook payloads).
- [ ] **Webhook / Poller Mode Verified**:
  - If using Cloudflare Tunnel: Verify `PUBLIC_BASE_URL` is active.
  - If using Polling: Confirm `watcher: polling` badge is displayed on Dashboard.
- [ ] **Browser Tabs Open**:
  - Tab 1: DevProof UI (`http://localhost:5173`)
  - Tab 2: Candidate GitHub Repo (`https://github.com/sranjit29794-bit/student-api`)
  - Tab 3: Terminal with backend logs

---

## 5-Minute Timestamped Demo Script

### 0:00 – 0:45 | The Core Problem & DevProof Invariants
- **Action**: Display DevProof Dashboard with persistent honesty banner.
- **Presenter Script**:
  > "Every career platform today relies on unverified claims—buzzwords on a resume or self-assessed LinkedIn endorsements. When AI is brought in, it usually hallucinates an arbitrary readiness percentage like '87% match'.
  >
  > DevProof takes an entirely different approach founded on verified honesty:
  > 1. **No Evidence -> No Credit**: A skill is only demonstrated if static AST code analysis proves it.
  > 2. **No Fake Scores**: We never show a single 0-100% readiness score.
  > 3. **Honest Scope**: If evidence isn't found, we report *'Not demonstrated in analyzed scope'* in neutral slate—never red, and never claiming the candidate lacks the skill.
  > 4. **Zero Code Execution**: We analyze code safely through AST parsing; we never execute untrusted candidate code."

---

### 0:45 – 1:30 | Step 1: Real Job & Resume Ingestion
- **Action**: Click **"New Opportunity Track"** wizard.
  1. Paste DoorDash job description from `docs/demo/job_paste.txt`.
  2. Upload `docs/demo/resume_b.pdf`.
  3. DevProof extracts 6 requirements and parses the GitHub repo URL directly from the PDF hyperlink annotation.
- **Presenter Script**:
  > "Watch our multi-source ingestion. We ingest the DoorDash Software Engineer posting. Notice how our parser extracts concrete, verifiable requirements—REST API, SQL database, automated testing, and deployment.
  >
  > Next, we upload the candidate's PDF resume. DevProof doesn't just read plain text; it extracts hyperlink annotations from the PDF structure to locate candidate GitHub profiles.
  >
  > Notice the **Claims Matrix**: the candidate claims SQL and Testing on their resume (`E0 Claimed`), but claims are not code."

---

### 1:30 – 2:30 | Step 2: Initial Assessment (Commit C0)
- **Action**: Connect `student-api` repository at commit `C0`. Click **"Run Initial Assessment"**.
- **Presenter Script**:
  > "DevProof's Repo Scout resolves commit `C0` and performs AST static analysis on the codebase.
  >
  > Look at the initial results:
  > - **REST API**: `DEMONSTRATED` (Green check). Click the card—you see the exact AST citations in `app/main.py:12-25` defining FastAPI routes.
  > - **SQL Database**: `NOT DEMONSTRATED IN ANALYZED SCOPE` (Slate dashed border). Even though the candidate claimed PostgreSQL on their resume, zero database models or queries exist in the code.
  > - **Testing**: `NOT DEMONSTRATED IN ANALYZED SCOPE`. No test suites exist in `C0`.
  > - **Deployment**: `PARTIALLY DEMONSTRATED` with a Dockerfile present, capped at static evidence.
  >
  > Note the citation links: clicking `app/main.py L12-25` opens the code viewer with exact line highlighting and commit SHA."

---

### 2:30 – 3:15 | Step 3: Candidate Attempts README Claim (Commit C1)
- **Action**: Trigger commit `C1` (candidate added PostgreSQL claims to `README.md` without writing code).
- **Presenter Script**:
  > "Now let's test our adversarial guardrails. Candidates often try to game AI evaluators by stuffing keywords into their README.
  >
  > Push `C1` arrives via GitHub webhook. Our **Change Sentinel** analyzes the diff. It immediately identifies: *'docs only: no skill change'*.
  >
  > Look at the UI: SQL remains `NOT DEMONSTRATED IN ANALYZED SCOPE`. DevProof records the README claim as an *ignored weak signal*, preventing gaming."

---

### 3:15 – 4:00 | Step 4: Real Implementation Push (Commit C2)
- **Action**: Trigger commit `C2` (SQLAlchemy models and pytest suite added).
- **Presenter Script**:
  > "Now the candidate pushes real code in commit `C2`: an `app/db.py` module with SQLAlchemy tables and `tests/test_api.py`.
  >
  > The Change Sentinel detects the push in real-time via SSE:
  > 1. **SQL Database**: Flips dynamically from *Not Demonstrated* to `DEMONSTRATED`. The evidence card cites `app/db.py:8-32` with parameterized schema models.
  > 2. **Testing**: Flips to `PARTIALLY DEMONSTRATED`. Why? Invariant #6: static analysis alone can verify test existence and project imports, but static analysis cannot confirm the tests pass."

---

### 4:00 – 4:30 | Step 5: Automated CI Upgrade & Diff View
- **Action**: GitHub Actions CI workflow finishes; GitHub emits a `check_run` completed event.
- **Presenter Script**:
  > "Minutes later, GitHub Actions finishes executing pytest. The CI check run succeeds.
  >
  > Watch the Testing card flip in real-time: **Testing is upgraded to `DEMONSTRATED (CI-verified)`**! We verified CI test execution via GitHub check metadata without ever running unsafe student code locally.
  >
  > Let's look at the **Compare Screen** (`C0 -> C2`):
  > - REST API: *Unchanged (retained demonstrated coverage)*.
  > - SQL Database: *Improved (verified implementation added in app/db.py)*.
  > - Testing: *Improved (test suite added + CI-verified)*.
  > - Limitations: Honest notes explaining what remains unverified."

---

### 4:30 – 5:00 | Summary & Conclusion
- **Presenter Script**:
  > "DevProof transforms career assessment into verifiable software engineering:
  > - Real AST static analysis
  > - No hallucinated readiness percentages
  > - Inbound webhooks with transparent polling fallback
  > - Prompt injection shields and adversarial resilience
  >
  > Thank you, and I welcome your questions."

---

## Fallback Procedures (If Things Go Wrong Live)

| Scenario | What Happens | What to Say / Do |
| :--- | :--- | :--- |
| **Webhook tunnel fails or disconnects** | Sentinel automatically falls back to polling default branch HEAD every 10s. | Point to the badge: *"Our webhook disconnected, and you can see DevProof automatically degraded gracefully to polling mode with zero data loss."* |
| **GitHub API Rate Limit hit** | GitHubClient returns cached ETag tree or structured `RATE_LIMITED` envelope with pause. | Show the Health screen: *"DevProof tracks API rate limits with exponential backoff and pauses polling safely."* |
| **LLM Provider down / timeout** | Engine automatically falls back to deterministic-only mode (`ai_used=false`). | Point to chip: *"DevProof runs in deterministic mode. Notice all verdicts and citations remain 100% accurate without an LLM."* |
| **Network completely offline** | Launch frontend in fixture mode: `VITE_USE_FIXTURES=1 npm run dev`. | Demonstrate all screens and live transitions using bundled demo fixtures. |

---

## Top Judge Questions & Honest Answers

### Q1: "Why don't you execute the candidate's code in a sandbox to run their tests directly?"
> **Answer**: "Security and determinism. Running arbitrary candidate code poses severe RCE and sandbox escape risks. Furthermore, a local execution environment may lack system dependencies. Instead, DevProof uses static AST analysis to verify test structure and imports, and hooks into GitHub's authenticated CI check runs (`check_run` / `workflow_run`) for execution proof. We get verified execution proof without the security risk."

### Q2: "Can a candidate trick the system by pasting SQL keywords into comments or docstrings?"
> **Answer**: "No. We parse the Python code into an Abstract Syntax Tree (AST). Comments and docstrings are filtered out and classified as weak signals (`counted=false`). A SQL query must be an actual AST string literal reaching an ORM or database executor to count."

### Q3: "Why don't you provide a single score like '85% match'?"
> **Answer**: "A single percentage score is mathematically misleading and encourages bias. For instance, is an 85% candidate missing basic security or missing a minor utility? DevProof reports granular, multi-dimensional facts across the Evidence Ladder (E0 to E5) so hiring managers see exact capabilities and limitations."

### Q4: "What happens if a candidate removes a file that previously proved a skill?"
> **Answer**: "DevProof's Diff Builder detects evidence deletion. If `app/db.py` is deleted in commit `C3`, SQL immediately regresses to *Not demonstrated in analyzed scope*, and the diff screen flags: *'SQL regressed because previously cited evidence was removed.'*"

### Q5: "How does the system work if my team doesn't have an OpenAI or LLM API key?"
> **Answer**: "DevProof was architected deterministically first. The AST detectors, status rules, impact map, diff builder, and evidence verifier run entirely with Python standard libraries and SQLAlchemy. The LLM is only an optional explanation layer."
