# DevProof Contract Delta (Phase R0)

This document records approved contract additions and schema updates established in Phase R0 per `docs/PLAN-5H.md` (§1.2 Amendments A1–A7, §4, §5). These amend `docs/BRAIN.md` §9, §10, and §13.

---

## 1. Schema Additions (`backend/app/schemas.py`)

### 1.1 Resume Ingestion & Claims
```python
class ResumeClaimKind(str, Enum):
    explicit = "explicit"
    inferred = "inferred"

class RepoCandidateKind(str, Enum):
    repo = "repo"
    profile = "profile"

class RepoCandidateSource(str, Enum):
    hyperlink = "hyperlink"
    text = "text"

class ResumeClaim(BaseModel):
    skill: str
    taxonomy_key: str | None = None
    source_line: int | str
    kind: ResumeClaimKind = ResumeClaimKind.explicit

class RepoCandidate(BaseModel):
    url: str
    owner: str
    name: str | None = None
    kind: RepoCandidateKind = RepoCandidateKind.repo
    source: RepoCandidateSource = RepoCandidateSource.text

class ResumeDraft(BaseModel):
    resume_id: str
    filename: str
    text_chars: int
    claimed_skills: list[ResumeClaim] = Field(default_factory=list)
    repo_candidates: list[RepoCandidate] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
```

### 1.2 Claims Matrix (F10-lite / PLAN-5H §1.2 A7)
```python
class ClaimsRepo(BaseModel):
    track_id: str
    full_name: str
    sha: str

class ClaimsCell(BaseModel):
    track_id: str
    status: Status
    strength: Strength

class ClaimsRow(BaseModel):
    requirement_id: str
    name: str
    claimed: bool
    claim_source_line: int | str | None = None
    cells: list[ClaimsCell] = Field(default_factory=list)

class ClaimsMatrix(BaseModel):
    job_id: str
    repos: list[ClaimsRepo] = Field(default_factory=list)
    rows: list[ClaimsRow] = Field(default_factory=list)
```

### 1.3 Track & Job Updates
```python
class SourceType(str, Enum):
    fetched = "fetched"
    user_provided = "user_provided"
    api = "api"

class JobDraft(BaseModel):
    id: str | None = None
    title: str
    company: str
    source_url: str
    source_type: SourceType = SourceType.fetched
    source_detail: str = ""
    raw_text: str = ""
    requirements: list[RequirementIn] = Field(default_factory=list)
    ambiguities: list[str] = Field(default_factory=list)
    confirmed: bool = False
    created_at: str | None = None

class TrackCreate(BaseModel):
    job_id: str
    repo_url: str
    branch: str = "main"
    resume_id: str | None = None

class Track(BaseModel):
    id: str
    job_id: str
    repo_id: str
    branch: str = "main"
    resume_id: str | None = None
    last_seen_sha: str | None = None
    watcher_mode: WatcherMode = WatcherMode.polling
    created_at: str | None = None
    job: JobDraft | None = None
    repo: Repo | None = None
    latest_analysis: Analysis | None = None
```

---

## 2. Database Model Delta (`backend/app/models.py`)

1. **`resumes` Table:**
   - `id`: String(64), Primary Key
   - `filename`: String(255), Not Null
   - `extracted_text`: Text, Not Null
   - `claimed_skills`: Generic JSON, Not Null
   - `repo_candidates`: Generic JSON, Not Null
   - `created_at`: DateTime(timezone=True), Not Null

2. **`tracks` Table:**
   - Added nullable `resume_id`: ForeignKey("resumes.id"), Index=True
   - Removed any unique constraint on `job_id` so one job supports multiple repository tracks.

3. **`jobs` Table:**
   - `source_type`: String(32), Default "fetched"
   - Added `source_detail`: String(255), Default "" (e.g. "Greenhouse API", "Lever API", "Direct Paste")

4. **`analyses` Table:**
   - Preserved `UNIQUE(track_id, commit_sha)` constraint.

---

## 3. API Contract Additions

### 3.1 `POST /api/resume/parse`
- **Request**: Multipart Form Data with `file: UploadFile` (.pdf, .txt) OR JSON `{ "text": str }`.
- **Response**: `ResumeDraft`
- **Error Response**: `ErrorEnvelope` with codes `INVALID_RESUME_FORMAT`, `RESUME_TOO_LARGE`, `EMPTY_RESUME_TEXT`.

### 3.2 `GET /api/github/users/{u}/repos`
- **Path Parameter**: `u: str` (GitHub username / organization)
- **Response**: `list[RepoCandidate]` (public, non-fork first, max 30).
- **Error Response**: `ErrorEnvelope` with codes `USER_NOT_FOUND`, `RATE_LIMITED`.

### 3.3 `GET /api/jobs/{id}/claims-matrix`
- **Path Parameter**: `id: str` (Job ID)
- **Response**: `ClaimsMatrix`
- **Error Response**: `ErrorEnvelope` with code `JOB_NOT_FOUND`.

### 3.4 `POST /api/tracks`
- **Request Body**: `TrackCreate { job_id, repo_url, branch, resume_id }`
- **Response**: `Track`
- **Error Response**: `ErrorEnvelope` with codes `JOB_NOT_FOUND`, `REPO_INVALID`.
