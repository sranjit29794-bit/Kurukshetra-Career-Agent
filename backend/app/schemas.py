from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ==============================================================================
# Fixed Enums (Source of Truth: docs/BRAIN.md §9, §10, §13)
# ==============================================================================

class AssessmentStatus(str, Enum):
    DEMONSTRATED = "DEMONSTRATED"
    PARTIAL = "PARTIAL"
    NOT_DEMONSTRATED = "NOT_DEMONSTRATED"
    UNABLE_TO_ASSESS = "UNABLE_TO_ASSESS"


class AnalysisStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETE = "complete"
    FAILED = "failed"


class Trigger(str, Enum):
    MANUAL = "manual"
    WEBHOOK = "webhook"
    POLL = "poll"


class AnalysisKind(str, Enum):
    INITIAL = "initial"
    REASSESSMENT = "reassessment"


class SourceType(str, Enum):
    FETCHED = "fetched"
    USER_PROVIDED = "user_provided"


class Priority(str, Enum):
    MUST = "must"
    NICE = "nice"


class WebhookStatus(str, Enum):
    REGISTERED = "registered"
    MANUAL = "manual"
    NONE = "none"


class WatcherMode(str, Enum):
    WEBHOOK = "webhook"
    POLLING = "polling"
    BOTH = "both"


class SignalStrength(str, Enum):
    STRONG = "strong"
    MEDIUM = "medium"
    WEAK = "weak"


class AssessmentStrength(str, Enum):
    STRONG = "strong"
    MODERATE = "moderate"
    LIMITED = "limited"
    NONE = "none"


class EventLevel(str, Enum):
    INFO = "info"
    WARN = "warn"
    ERROR = "error"
    SUCCESS = "success"


class DiffChange(str, Enum):
    IMPROVED = "improved"
    REGRESSED = "regressed"
    UNCHANGED = "unchanged"
    NEWLY_ASSESSED = "newly_assessed"


# ==============================================================================
# Consistent Error Model
# ==============================================================================

class ErrorDetail(BaseModel):
    code: str
    message: str
    retryable: bool = False
    reset_epoch: Optional[int] = None


class ErrorResponse(BaseModel):
    error: ErrorDetail


# ==============================================================================
# Scope Model (docs/BRAIN.md §11)
# ==============================================================================

class Scope(BaseModel):
    analyzed: int = Field(..., description="Number of analyzable files included")
    skipped: int = Field(..., description="Number of files skipped by filters")
    skipped_reasons: Dict[str, int] = Field(
        default_factory=dict,
        description="Categorized reasons for skipped files (e.g. excluded_dir, binary, size_exceeded)",
    )
    truncated: bool = Field(
        default=False,
        description="Whether the GitHub tree response was truncated",
    )


# ==============================================================================
# Evidence & Signal Models (docs/BRAIN.md §10.2, §9)
# ==============================================================================

class EvidenceItem(BaseModel):
    id: Optional[int] = None
    signal_id: str = Field(..., description="Stable hash of detector, path, lines, and blob SHA")
    detector: str = Field(..., description="Name of detector (e.g. rest_api, sql_database, python)")
    file_path: str = Field(..., description="Repository file path")
    line_start: int
    line_end: int
    snippet: str
    blob_sha: str
    strength: SignalStrength
    counted: bool = Field(..., description="True if evidence counts towards score; False if ignored weak signal")
    github_url: Optional[str] = Field(None, description="Direct immutable GitHub source anchor blob URL at evaluated commit SHA")


# ==============================================================================
# Repository Connection Models (docs/BRAIN.md §13, §9)
# ==============================================================================

class RepoConnectRequest(BaseModel):
    repo_url: str
    branch: Optional[str] = None


class RepoConnectResult(BaseModel):
    id: Optional[int] = None
    owner: str
    name: str
    html_url: str
    default_branch: str
    head_sha: str
    scope: Scope
    webhook_status: WebhookStatus
    webhook_id: Optional[int] = None


# ==============================================================================
# Job & Requirement Models (docs/BRAIN.md §9, §12)
# ==============================================================================

class RequirementDraft(BaseModel):
    id: Optional[int] = None
    name: str
    category: str
    priority: Priority = Priority.MUST
    source_sentence: str
    taxonomy_key: Optional[str] = None
    search_terms: List[str] = Field(default_factory=list)
    position: Optional[int] = 0


class JobExtractRequest(BaseModel):
    url: Optional[str] = None
    text: Optional[str] = None
    source_url: Optional[str] = None


class JobDraft(BaseModel):
    id: Optional[int] = None
    title: str
    company: str
    source_url: Optional[str] = None
    source_type: SourceType
    raw_text: Optional[str] = None
    confirmed: bool = False
    requirements: List[RequirementDraft] = Field(default_factory=list)
    ambiguities: List[str] = Field(default_factory=list)


class JobUpdateRequest(BaseModel):
    title: str
    company: str
    requirements: List[RequirementDraft]
    confirmed: bool = True


# ==============================================================================
# Track Models (docs/BRAIN.md §9)
# ==============================================================================

class TrackCreateRequest(BaseModel):
    job_id: int
    repo_id: int
    branch: Optional[str] = None
    head_sha: Optional[str] = None


class TrackSummary(BaseModel):
    id: int
    job_id: int
    repo_id: int
    branch: str
    last_seen_sha: Optional[str] = None
    watcher_mode: WatcherMode = WatcherMode.POLLING
    created_at: datetime


class TrackDetail(BaseModel):
    id: int
    job_id: int
    repo_id: int
    branch: str
    last_seen_sha: Optional[str] = None
    watcher_mode: WatcherMode = WatcherMode.POLLING
    created_at: datetime
    job: JobDraft
    repo: RepoConnectResult


# ==============================================================================
# Assessment Models (docs/BRAIN.md §9, §10, §12)
# ==============================================================================

class Assessment(BaseModel):
    id: Optional[int] = None
    analysis_id: Optional[int] = None
    requirement_id: int
    requirement_name: Optional[str] = None
    status: AssessmentStatus
    strength: AssessmentStrength
    summary: str
    limitation: Optional[str] = None
    next_step: Optional[str] = None
    carried_forward: bool = False
    reassessed: bool = False
    ignored_signals: List[Dict[str, Any]] = Field(default_factory=list)
    ai_used: bool = False
    evidence: List[EvidenceItem] = Field(default_factory=list)


# ==============================================================================
# Diff Models (docs/BRAIN.md §15.2)
# ==============================================================================

class DiffItem(BaseModel):
    requirement_id: int
    name: str
    before_status: Optional[AssessmentStatus] = None
    after_status: AssessmentStatus
    change: DiffChange
    evidence_added: List[EvidenceItem] = Field(default_factory=list)
    evidence_removed: List[EvidenceItem] = Field(default_factory=list)
    reassessed: bool = True
    why: Optional[str] = None
    remaining_limitation: Optional[str] = None


class DiffResponse(BaseModel):
    analysis_id: int
    from_analysis_id: Optional[int] = None
    to_analysis_id: Optional[int] = None
    from_sha: str
    to_sha: str
    commit_message: Optional[str] = None
    files_changed: List[str] = Field(default_factory=list)
    items: List[DiffItem] = Field(default_factory=list)
    reassessed_count: int = 0
    carried_forward_count: int = 0


# ==============================================================================
# Analysis Detail Model (docs/BRAIN.md §9, §13)
# ==============================================================================

class AnalysisDetail(BaseModel):
    id: int
    track_id: int
    commit_sha: str
    commit_message: Optional[str] = None
    trigger: Trigger
    kind: AnalysisKind
    status: AnalysisStatus
    prev_analysis_id: Optional[int] = None
    scope: Optional[Dict[str, Any]] = None
    ai_used: bool = False
    error: Optional[str] = None
    started_at: datetime
    finished_at: Optional[datetime] = None
    assessments: List[Assessment] = Field(default_factory=list)


# ==============================================================================
# Agent Event Models (docs/BRAIN.md §9, §13)
# ==============================================================================

class AgentEvent(BaseModel):
    id: Optional[int] = None
    track_id: Optional[int] = None
    analysis_id: Optional[int] = None
    agent: str
    level: EventLevel
    message: str
    timestamp: datetime


class AgentEventDetail(BaseModel):
    id: int
    track_id: Optional[int] = None
    analysis_id: Optional[int] = None
    agent: str
    level: EventLevel
    message: str
    timestamp: datetime
    commit_sha: Optional[str] = None
    track_title: Optional[str] = None
    repo_name: Optional[str] = None


# ==============================================================================
# Grounded Coaching Models (docs/BRAIN.md §12, §13; PHASE_PLAN_V2 Phase 8)
# ==============================================================================

class CoachingProof(BaseModel):
    file_path: str
    line_start: int
    line_end: int
    detector: str
    snippet: str
    github_url: Optional[str] = None


class CoachingItem(BaseModel):
    requirement_id: int
    requirement_name: str
    category: str
    priority: str
    status: AssessmentStatus
    status_label: str
    action_title: str
    why: str
    implementation_guide: str
    estimated_effort: str
    verified_proof: List[CoachingProof] = Field(default_factory=list)
    scope_caveat: Optional[str] = None
    is_actionable: bool
    status_claim: str = "recommendation"


class CoachingResponse(BaseModel):
    track_id: int
    track_title: str
    repo_full_name: str
    commit_sha: str
    generated_at: datetime
    ai_used: bool
    summary: str
    strengths_count: int
    gaps_count: int
    items: List[CoachingItem]


# ==============================================================================
# Health Response Model (docs/BRAIN.md §13)
# ==============================================================================

class HealthResponse(BaseModel):
    backend: str = "ok"
    llm: str = Field(..., description="ok | down | disabled | unconfigured")
    github: str = Field(..., description="ok | rate_limited | unconfigured | error")
    github_rate_remaining: Optional[int] = None
    watcher: str = Field(..., description="webhook | polling | both | unconfigured | idle")
    next_poll_in_s: Optional[int] = None
    timestamp: datetime
