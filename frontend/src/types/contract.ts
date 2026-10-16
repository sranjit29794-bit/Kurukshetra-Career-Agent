// ==============================================================================
// Fixed Enums (Source of Truth: docs/BRAIN.md §9, §10, §13)
// ==============================================================================

export type AssessmentStatus =
  | 'DEMONSTRATED'
  | 'PARTIAL'
  | 'NOT_DEMONSTRATED'
  | 'UNABLE_TO_ASSESS';

export type AnalysisStatus = 'queued' | 'running' | 'complete' | 'failed';

export type Trigger = 'manual' | 'webhook' | 'poll';

export type AnalysisKind = 'initial' | 'reassessment';

export type SourceType = 'fetched' | 'user_provided';

export type Priority = 'must' | 'nice';

export type WebhookStatus = 'registered' | 'manual' | 'none';

export type WatcherMode = 'webhook' | 'polling' | 'both';

export type SignalStrength = 'strong' | 'medium' | 'weak';

export type AssessmentStrength = 'strong' | 'moderate' | 'limited' | 'none';

export type EventLevel = 'info' | 'warn' | 'error' | 'success';

export type DiffChange = 'improved' | 'regressed' | 'unchanged' | 'newly_assessed';

// ==============================================================================
// Consistent Error Response Model
// ==============================================================================

export interface ErrorDetail {
  code: string;
  message: string;
  retryable?: boolean;
}

export interface ErrorResponse {
  error: ErrorDetail;
}

// ==============================================================================
// Scope Model (docs/BRAIN.md §11)
// ==============================================================================

export interface Scope {
  analyzed: number;
  skipped: number;
  skipped_reasons: Record<string, number>;
  truncated: boolean;
}

// ==============================================================================
// Evidence & Signal Models (docs/BRAIN.md §10.2, §9)
// ==============================================================================

export interface EvidenceItem {
  id?: number;
  signal_id: string;
  detector: string;
  file_path: string;
  line_start: number;
  line_end: number;
  snippet: string;
  blob_sha: string;
  strength: SignalStrength;
  counted: boolean;
}

// ==============================================================================
// Repository Connection Models (docs/BRAIN.md §13, §9)
// ==============================================================================

export interface RepoConnectRequest {
  repo_url: string;
  branch?: string;
}

export interface RepoConnectResult {
  id?: number;
  owner: string;
  name: string;
  html_url: string;
  default_branch: string;
  head_sha: string;
  scope: Scope;
  webhook_status: WebhookStatus;
  webhook_id?: number | null;
}

// ==============================================================================
// Job & Requirement Models (docs/BRAIN.md §9, §12)
// ==============================================================================

export interface RequirementDraft {
  id?: number;
  name: string;
  category: string;
  priority: Priority;
  source_sentence: string;
  taxonomy_key?: string | null;
  search_terms: string[];
  position?: number;
}

export interface JobExtractRequest {
  url?: string;
  text?: string;
  source_url?: string;
}

export interface JobDraft {
  id?: number;
  title: string;
  company: string;
  source_url?: string | null;
  source_type: SourceType;
  raw_text?: string | null;
  confirmed: boolean;
  requirements: RequirementDraft[];
  ambiguities: string[];
}

export interface JobUpdateRequest {
  title: string;
  company: string;
  requirements: RequirementDraft[];
  confirmed: boolean;
}

// ==============================================================================
// Track Models (docs/BRAIN.md §9)
// ==============================================================================

export interface TrackCreateRequest {
  job_id: number;
  repo_id: number;
}

export interface TrackSummary {
  id: number;
  job_id: number;
  repo_id: number;
  branch: string;
  last_seen_sha?: string | null;
  watcher_mode: WatcherMode;
  created_at: string;
}

// ==============================================================================
// Assessment Models (docs/BRAIN.md §9, §10, §12)
// ==============================================================================

export interface Assessment {
  id?: number;
  analysis_id?: number;
  requirement_id: number;
  requirement_name?: string | null;
  status: AssessmentStatus;
  strength: AssessmentStrength;
  summary: string;
  limitation?: string | null;
  next_step?: string | null;
  carried_forward: boolean;
  reassessed: boolean;
  ignored_signals: Array<Record<string, any>>;
  ai_used: boolean;
  evidence: EvidenceItem[];
}

// ==============================================================================
// Diff Models (docs/BRAIN.md §15.2)
// ==============================================================================

export interface DiffItem {
  requirement_id: number;
  name: string;
  before_status?: AssessmentStatus | null;
  after_status: AssessmentStatus;
  change: DiffChange;
  evidence_added: EvidenceItem[];
  evidence_removed: EvidenceItem[];
  reassessed: boolean;
  why?: string | null;
  remaining_limitation?: string | null;
}

export interface DiffResponse {
  analysis_id: number;
  from_sha: string;
  to_sha: string;
  commit_message?: string | null;
  files_changed: string[];
  items: DiffItem[];
  reassessed_count: number;
  carried_forward_count: number;
}

// ==============================================================================
// Analysis Detail Model (docs/BRAIN.md §9, §13)
// ==============================================================================

export interface AnalysisDetail {
  id: number;
  track_id: number;
  commit_sha: string;
  commit_message?: string | null;
  trigger: Trigger;
  kind: AnalysisKind;
  status: AnalysisStatus;
  prev_analysis_id?: number | null;
  scope: Scope;
  ai_used: boolean;
  error?: string | null;
  started_at: string;
  finished_at?: string | null;
  assessments: Assessment[];
}

// ==============================================================================
// Agent Event Models (docs/BRAIN.md §9, §13)
// ==============================================================================

export interface AgentEvent {
  id?: number;
  track_id?: number | null;
  analysis_id?: number | null;
  agent: string;
  level: EventLevel;
  message: string;
  timestamp: string;
}

// ==============================================================================
// Health Response Model (docs/BRAIN.md §13)
// ==============================================================================

export interface HealthResponse {
  backend: string;
  llm: 'ok' | 'down' | 'disabled' | 'unconfigured';
  github: 'ok' | 'rate_limited' | 'unconfigured' | 'error';
  github_rate_remaining?: number | null;
  watcher: 'webhook' | 'polling' | 'both' | 'unconfigured' | 'idle';
  next_poll_in_s?: number | null;
  timestamp: string;
}
