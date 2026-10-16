/**
 * Frontend TypeScript contracts matching backend Pydantic schemas.
 * Reference: docs/BRAIN.md (§9, §10, §13, §15.2, §16).
 */

export type Status = 'DEMONSTRATED' | 'PARTIAL' | 'NOT_DEMONSTRATED' | 'UNABLE_TO_ASSESS';

export type Strength = 'strong' | 'moderate' | 'limited' | 'none';

export type Priority = 'must' | 'nice';

export type SourceType = 'fetched' | 'user_provided';

export interface Requirement {
  id: string;
  name: string;
  category: string;
  priority: Priority;
  source_sentence: string;
  taxonomy_key?: string | null;
  search_terms?: string[];
  position?: number;
}

export interface JobDraft {
  id?: string | null;
  title: string;
  company: string;
  source_url: string;
  source_type: SourceType;
  raw_text?: string;
  requirements: Requirement[];
  ambiguities?: string[];
  confirmed?: boolean;
  created_at?: string | null;
}

export interface ScopeInfo {
  analyzed: number;
  skipped: number;
  skipped_reasons: Record<string, number>;
  truncated: boolean;
}

export interface RepoValidationResult {
  valid: boolean;
  owner: string;
  name: string;
  default_branch: string;
  head_sha: string;
  commit_message: string;
  analyzable_files: number;
  scope: ScopeInfo;
  is_python_backend: boolean;
  error?: string | null;
  error_type?: 'private_repo' | 'non_python' | 'network' | null;
}

export interface Repo {
  id: string;
  owner: string;
  name: string;
  default_branch: string;
  html_url: string;
  webhook_id?: string | null;
  webhook_status: 'registered' | 'manual' | 'none';
  created_at?: string | null;
}

export interface Evidence {
  id: string;
  assessment_id?: string | null;
  signal_id: string;
  detector: string;
  file_path: string;
  line_start: number;
  line_end: number;
  snippet: string;
  blob_sha: string;
  strength: 'strong' | 'medium' | 'weak';
  counted: boolean;
}

export interface IgnoredSignal {
  reason: string;
  file_path?: string;
  line?: number;
}

export interface VerifiedAssessment {
  id: string;
  analysis_id: string;
  requirement_id: string;
  status: Status;
  strength: Strength;
  summary: string;
  limitation: string;
  next_step: string;
  carried_forward: boolean;
  reassessed: boolean;
  ignored_signals: IgnoredSignal[];
  ai_used: boolean;
  evidence: Evidence[];
}

export interface TrackOpportunity {
  id: string;
  job: JobDraft;
  repo: Repo;
  branch: string;
  last_seen_sha: string;
  last_assessed_at: string;
  watcher_mode: 'webhook' | 'polling' | 'both';
  status_summary: {
    demonstrated: number;
    partial: number;
    not_demonstrated: number;
    unable: number;
  };
  assessments: VerifiedAssessment[];
}

export interface RecentChange {
  id: string;
  commit_sha: string;
  commit_message: string;
  author: string;
  timestamp: string;
  files_changed_count: number;
  skills_reassessed: string[];
  skills_unchanged: string[];
  transitions: Array<{
    skill: string;
    before: Status;
    after: Status;
    change: 'improved' | 'regressed' | 'unchanged' | 'newly_assessed';
  }>;
}

export interface NextAction {
  id: string;
  skill: string;
  title: string;
  detail: string;
  priority: Priority;
  target_file?: string;
}

export interface AgentEvent {
  id: number | string;
  track_id?: string;
  analysis_id?: string;
  agent: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  ts?: string;
  created_at?: string;
}
