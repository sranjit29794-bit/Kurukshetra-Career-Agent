# Demo Repository Notes (`student-api`)

Reference: `docs/BRAIN.md` §19.1.

This document specifies the exact commits and file contents for the `student-api` repository used in the DevProof live evaluation demo.

---

## Commit C0 — Baseline (`a1b2c3d`)
**Commit Message:** `Initial commit: FastAPI backend with in-memory store`

### Purpose
Represents an early student project where the resume and README make bold claims, but the repository code only partially demonstrates them.

### Files & Structure
- `app/main.py`:
  - FastAPI app with standard routes (`@app.get('/items')`, `@app.post('/items')`).
  - Pydantic models (`ItemCreate`).
  - In-memory list store (`items = []`).
  - Decoy comment: `# TODO: add SQL`.
- `README.md`:
  - Claims: *"Built with FastAPI and PostgreSQL. Full test coverage included."*
- `tests/test_smoke.py`:
  - Contains only:
    ```python
    def test_smoke():
        assert True
    ```
- No `Dockerfile`, no database driver, no database files.

### Expected Assessment Results
| Skill | Status | Strength | Citations / Reasons |
|---|---|---|---|
| **REST APIs** | `DEMONSTRATED` | `strong` | `app/main.py:15-32` (@app.get, @app.post with request bodies) |
| **SQL Database** | `NOT_DEMONSTRATED` | `none` | Ignored signals: README claim rejected; `# TODO: add SQL` rejected |
| **Testing** | `NOT_DEMONSTRATED` | `none` | Ignored signal: `tests/test_smoke.py` (`assert True` has zero credit) |
| **Deployment** | `NOT_DEMONSTRATED` | `none` | No Dockerfile or deploy manifests found in analyzed scope |
| **Python** | `DEMONSTRATED` | `strong` | `app/main.py:1-35` (Type hints, Pydantic models) |

---

## Commit C1 — Live Push #1 (`b2c3d4e`)
**Commit Message:** `docs: update README with API documentation`

### Purpose
Proves **Change Sentinel intelligence** and **Weak-signal immunity**: pushing text/docs updates triggers webhook analysis, but cannot artificially upgrade technical skills.

### Files Changed
- `README.md` only (added API curl examples and documentation).

### Expected Assessment Results
- Sentinel detects `*.md` change only.
- Invariant #7 applied: *"A commit is a reason to reassess, not proof of improvement."*
- Reassessment results: **0 skills upgraded**.
- Timeline displays: *"Documentation changes only — no skills reassessed or upgraded."*

---

## Commit C2 — Live Push #2 (`c3d4e5f`)
**Commit Message:** `feat(db): add sqlite database and tests`

### Purpose
Demonstrates the core loop: real code additions trigger automatic reassessment, update only impacted skills, cite new file/line evidence, and explain the transition.

### Files Changed
- `app/db.py` (New):
  - Parameterized SQLite query execution:
    ```python
    cursor.execute("INSERT INTO items (name, price) VALUES (?, ?)", (name, price))
    ```
- `app/main.py` (Modified):
  - Handlers updated to invoke `db.insert_item()` and `db.get_items()`.
- `tests/test_db.py` (New):
  - Meaningful assertions against an isolated database:
    ```python
    def test_insert_and_get_item(temp_db):
        res = db.insert_item("Book", 19.99)
        assert res["id"] is not None
        assert db.get_items()[0]["name"] == "Book"
    ```

### Expected Assessment Results
| Skill | Transition | After Status | Evidence & Notes |
|---|---|---|---|
| **SQL Database** | `○ → ✓` | `DEMONSTRATED` | `app/db.py:12-30` (parameterized query with binding) |
| **Testing** | `○ → ◐` | `PARTIAL` | `tests/test_db.py:8-24` (meaningful asserts; capped at PARTIAL per Invariant #6) |
| **REST APIs** | `✓ → ✓` | `DEMONSTRATED` | Reassessed; handler connected to db |
| **Python** | `✓ → ✓` | `DEMONSTRATED` | Unchanged / verified |
| **Deployment** | `○ → ○` | `NOT_DEMONSTRATED` | Carried forward without re-running |

### UI Payoff in Compare View
- Diff shows `SQL: Improved` with accent glow and citation links.
- Diff shows `Testing: Improved (Partially demonstrated)` with limitation: *"Tests present with assertions, but code execution was not run."*
- Unchanged rows marked *"Not reassessed — no related files changed."*
