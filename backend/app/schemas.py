"""Pydantic v2 schemas for DevProof.

Strict contracts for API, engine, detectors, agents, and frontend data exchange.
Reference: docs/BRAIN.md (§3, §9, §10, §13, §15.2).
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import AliasChoices, BaseModel, Field

# --- Enums (BRAIN §9, §10, §15.2) ---


class Status(str, Enum):
    """Assessment status enum per BRAIN §10.1."""

    DEMONSTRATED = "DEMONSTRATED"
    PARTIAL = "PARTIAL"
    NOT_DEMONSTRATED = "NOT_DEMONSTRATED"
    UNABLE_TO_ASSESS = "UNABLE_TO_ASSESS"


class Strength(str, Enum):
    """Assessment confidence strength label per BRAIN §10.4."""

    strong = "strong"
    moderate = "moderate"
    limited = "limited"
    none = "none"


class SignalStrength(str, Enum):
    """Detector signal strength per BRAIN §10.2."""

    strong = "strong"
    medium = "medium"
    weak = "weak"


class Priority(str, Enum):
    """Job requirement priority per BRAIN §11."""

    must = "must"
    nice = "nice"


class SourceType(str, Enum):
    """Job draft source type per BRAIN §9 and PLAN-5H §1.2."""

    fetched = "fetched"
    user_provided = "user_provided"
    api = "api"


class ResumeClaimKind(str, Enum):
    """Classification of how a resume claim was identified."""

    explicit = "explicit"
    inferred = "inferred"


class RepoCandidateKind(str, Enum):
    """Whether a candidate GitHub URL is a specific repo or a profile."""

    repo = "repo"
    profile = "profile"


class RepoCandidateSource(str, Enum):
    """How the link was extracted from the resume PDF/text."""

    hyperlink = "hyperlink"
    text = "text"


class Trigger(str, Enum):
    """Analysis trigger origin per BRAIN §9."""

    manual = "manual"
    webhook = "webhook"
    poll = "poll"


class AnalysisKind(str, Enum):
    """Initial assessment or reassessment upon commit push."""

    initial = "initial"
    reassessment = "reassessment"


class AnalysisStatus(str, Enum):
    """Analysis execution state."""

    queued = "queued"
    running = "running"
    complete = "complete"
    failed = "failed"


class AgentLevel(str, Enum):
    """Agent activity event severity level."""

    info = "info"
    warn = "warn"
    error = "error"
    success = "success"


class WatcherMode(str, Enum):
    """Repository change watcher mode."""

    webhook = "webhook"
    polling = "polling"
    both = "both"


class WebhookStatus(str, Enum):
    """Repository webhook registration state."""

    registered = "registered"
    manual = "manual"
    none = "none"


class DiffChange(str, Enum):
    """Status transition type for a requirement between two analyses."""

    improved = "improved"
    regressed = "regressed"
    unchanged = "unchanged"
    newly_assessed = "newly_assessed"


# --- Signal & Repository Models (BRAIN §10.2, §11, §14) ---


class Signal(BaseModel):
    """Deterministic signal produced by a detector."""

    signal_id: str = Field(
        ..., description="Stable SHA-256 hash of detector, path, lines, blob_sha"
    )
    detector: str = Field(..., description="Taxonomy key / detector name")
    strength: SignalStrength
    file_path: str
    line_start: int
    line_end: int
    snippet: str
    blob_sha: str
    reason: str
    counted: bool = Field(
        default=True, description="False if filtered by weak-signal gate"
    )


class RepoFile(BaseModel):
    """Single file representation in a repository snapshot."""

    path: str
    blob_sha: str
    size_bytes: int = 0
    content: str | None = None


class ScopeInfo(BaseModel):
    """Analysis file scope reporting per BRAIN §11."""

    analyzed: int = 0
    skipped: int = 0
    skipped_reasons: dict[str, int] = Field(default_factory=dict)
    truncated: bool = False


class CommitInfo(BaseModel):
    """Commit metadata from GitHub."""

    sha: str
    message: str
    author: str = ""
    date: str = ""


class RepoSnapshot(BaseModel):
    """Snapshot of repository state at a specific commit SHA."""

    repo_url: str
    commit_sha: str
    commit_info: CommitInfo
    files: list[RepoFile] = Field(default_factory=list)
    scope: ScopeInfo = Field(default_factory=ScopeInfo)


# --- Requirements & Job Models (BRAIN §9, §11) ---


class RequirementIn(BaseModel):
    """A requirement extracted from a job description."""

    id: str | None = None
    name: str
    category: str
    priority: Priority = Priority.must
    source_sentence: str
    taxonomy_key: str | None = None
    search_terms: list[str] = Field(default_factory=list)
    position: int = 0


class DroppedRequirement(BaseModel):
    """A requirement dropped during validation."""

    skill_key: str
    quote: str
    reason: str


class JobDraft(BaseModel):
    """Structured job description with extracted requirements."""

    status: str = "ok"
    id: str | None = None
    title: str
    company: str
    source_url: str
    source_type: SourceType = SourceType.fetched
    source_detail: str = ""
    raw_text: str = ""
    requirements: list[RequirementIn] = Field(default_factory=list)
    dropped: list[DroppedRequirement] = Field(default_factory=list)
    extraction_mode: str = "llm"  # "llm" or "Deterministic only"
    ambiguities: list[str] = Field(default_factory=list)
    confirmed: bool = False
    created_at: str | None = None


class JobExtractNeedsPaste(BaseModel):
    """Typed result when a job URL requires manual paste (e.g. LinkedIn or login wall)."""

    status: Literal["needs_paste"] = "needs_paste"
    reason: str = "login_required"
    source_url: str = ""
    message: str = "LinkedIn / external site requires login authentication. Please paste the job description text."


# --- Resume & Claims Matrix Models (PLAN-5H §1.2, §3, R0) ---


class ResumeClaim(BaseModel):
    """A skill claimed on a candidate's resume."""

    skill: str
    taxonomy_key: str | None = None
    source_line: int | str
    kind: ResumeClaimKind = ResumeClaimKind.explicit


class RepoCandidate(BaseModel):
    """A GitHub repository or profile discovered in a resume or user listing."""

    url: str
    owner: str
    name: str | None = None
    kind: RepoCandidateKind = RepoCandidateKind.repo
    source: RepoCandidateSource = RepoCandidateSource.text
    description: str | None = None
    language: str | None = None
    pushed_at: str | None = None
    fork: bool = False
    archived: bool = False


class ResumeDraft(BaseModel):
    """Extracted resume claims and candidate repositories."""

    status: str = "ok"
    resume_id: str
    filename: str
    text_chars: int
    claimed_skills: list[ResumeClaim] = Field(default_factory=list)
    repo_candidates: list[RepoCandidate] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class ClaimsRepo(BaseModel):
    """Repository column definition for the Claims Matrix."""

    track_id: str
    full_name: str
    sha: str


class ClaimsCell(BaseModel):
    """Assessment status cell for a specific repository track."""

    track_id: str
    status: Status
    strength: Strength


class ClaimsRow(BaseModel):
    """A single requirement row in the Claims Matrix."""

    requirement_id: str
    name: str
    claimed: bool
    claim_source_line: int | str | None = None
    cells: list[ClaimsCell] = Field(default_factory=list)


class ClaimsMatrix(BaseModel):
    """Matrix comparing resume claims against repo assessments across tracks."""

    job_id: str
    repos: list[ClaimsRepo] = Field(default_factory=list)
    rows: list[ClaimsRow] = Field(default_factory=list)


# --- Evidence & Assessment Models (BRAIN §9, §10) ---


class Evidence(BaseModel):
    """Verified evidence snippet linking to a source signal."""

    id: str
    assessment_id: str | None = None
    signal_id: str
    detector: str
    file_path: str
    line_start: int
    line_end: int
    snippet: str
    blob_sha: str
    strength: SignalStrength
    counted: bool = True


class DraftAssessment(BaseModel):
    """Preliminary assessment generated by Evidence Analyst before verification."""

    requirement_id: str
    status: Status
    strength: Strength
    summary: str
    limitation: str
    next_step: str
    cited_signal_ids: list[str] = Field(default_factory=list)
    ignored_signals: list[dict[str, Any]] = Field(default_factory=list)


class VerifiedAssessment(BaseModel):
    """Verified assessment produced after Verifier checks and Coach narration."""

    id: str
    analysis_id: str
    requirement_id: str
    status: Status
    strength: Strength
    summary: str
    limitation: str
    next_step: str
    carried_forward: bool = False
    reassessed: bool = True
    ignored_signals: list[dict[str, Any]] = Field(default_factory=list)
    ai_used: bool = True
    evidence: list[Evidence] = Field(default_factory=list)


# --- Diff & Change Impact Models (BRAIN §15) ---


class DiffItem(BaseModel):
    """Per-requirement status and evidence delta."""

    requirement_id: str
    name: str
    before_status: Status
    after_status: Status
    change: DiffChange
    evidence_added: list[Evidence] = Field(default_factory=list)
    evidence_removed: list[Evidence] = Field(default_factory=list)
    reassessed: bool = True
    why: str = ""


class Diff(BaseModel):
    """Structured comparison between two analyses."""

    from_sha: str
    to_sha: str
    commit_message: str
    files_changed: list[str] = Field(default_factory=list)
    items: list[DiffItem] = Field(default_factory=list)


class ImpactPlan(BaseModel):
    """Calculated plan of requirements to reassess vs carry forward."""

    reassess: list[str] = Field(default_factory=list)
    carry_forward: list[str] = Field(default_factory=list)
    reasons: dict[str, str] = Field(default_factory=dict)


class ChangeSet(BaseModel):
    """Detected git changes triggering reassessment."""

    id: str | None = None
    analysis_id: str | None = None
    before_sha: str
    after_sha: str
    files_added: list[str] = Field(default_factory=list)
    files_removed: list[str] = Field(default_factory=list)
    files_modified: list[str] = Field(default_factory=list)
    impact_plan: ImpactPlan = Field(default_factory=ImpactPlan)


# --- Repos, Tracks & Analyses (BRAIN §9) ---


class Repo(BaseModel):
    """Connected GitHub repository metadata."""

    id: str
    owner: str
    name: str
    default_branch: str = "main"
    html_url: str
    head_sha: str | None = None
    scope: ScopeInfo | None = None
    webhook_id: str | None = None
    webhook_status: WebhookStatus = WebhookStatus.none
    created_at: str | None = None


class RepoConnectRequest(BaseModel):
    """Payload to connect a GitHub repository."""

    repo_url: str = Field(validation_alias=AliasChoices("repo_url", "url"))
    branch: str | None = None


class Analysis(BaseModel):
    """An assessment run pinned to a specific commit SHA."""

    id: str
    track_id: str
    commit_sha: str
    commit_message: str = ""
    trigger: Trigger = Trigger.manual
    kind: AnalysisKind = AnalysisKind.initial
    status: AnalysisStatus = AnalysisStatus.complete
    prev_analysis_id: str | None = None
    scope: ScopeInfo | None = None
    ai_used: bool = False
    error: str | None = None
    started_at: str | None = None
    finished_at: str | None = None
    assessments: list[VerifiedAssessment] = Field(default_factory=list)


class Track(BaseModel):
    """Track linking a job requirement set and a repository."""

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
    assessments: list[VerifiedAssessment] = Field(default_factory=list)


class TrackCreate(BaseModel):
    """Payload to create a new track linking a job and repo."""

    job_id: str
    repo_url: str
    branch: str = "main"
    resume_id: str | None = None


class AgentEvent(BaseModel):
    """Event emitted for the Agent Activity Feed."""

    id: int | str | None = None
    track_id: str
    analysis_id: str | None = None
    agent: str
    level: AgentLevel
    message: str
    ts: str | None = None


# --- Error Envelope & Health Models (BRAIN §13) ---


class ErrorDetail(BaseModel):
    """Standardized error object."""

    code: str
    message: str
    retryable: bool = False


class ErrorEnvelope(BaseModel):
    """Standardized error response container."""

    error: ErrorDetail


class Health(BaseModel):
    """Health check response schema."""

    llm: str
    github: str
    rate_remaining: int
    watcher: str
    next_poll_in_s: int
    db_path: str = ""
    row_counts: dict[str, int] = Field(default_factory=dict)
    mode: str = "real"


class EvidenceFile(BaseModel):
    """File content and range associated with an evidence citation."""

    path: str
    sha: str
    content: str
    line_start: int
    line_end: int
