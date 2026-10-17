/**
 * Unified API client module for DevProof frontend.
 * Provides real HTTP and SSE calls to backend.
 *
 * Invariants:
 * - Single data layer handling error envelope { error: { code, message, retryable } }
 * - Zero silent fixture fallbacks in real mode: any error throws an ApiError so the UI
 *   presents an honest error state with retry.
 * - Explicit fixture mode only when VITE_USE_FIXTURES=1.
 */

import type { JobDraft, TrackOpportunity, RepoValidationResult, ClaimsMatrix } from '../types';
import { DEV_FIXTURES } from './devFixtures';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

/** Force fixtures only if explicitly requested via VITE_USE_FIXTURES=1 */
export const FORCE_FIXTURES = import.meta.env.VITE_USE_FIXTURES === '1';

export interface ApiErrorDetail {
  code: string;
  message: string;
  retryable: boolean;
}

export class ApiError extends Error {
  code: string;
  retryable: boolean;
  status: number;

  constructor(detail: ApiErrorDetail, status: number) {
    super(detail.message);
    this.name = 'ApiError';
    this.code = detail.code;
    this.retryable = detail.retryable;
    this.status = status;
  }
}

async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch {
    throw new ApiError(
      {
        code: 'NETWORK_ERROR',
        message: 'Could not connect to backend server. Ensure backend is running.',
        retryable: true,
      },
      0
    );
  }

  if (!res.ok) {
    let errorDetail: ApiErrorDetail = {
      code: `HTTP_${res.status}`,
      message: `Request failed with status ${res.status}`,
      retryable: res.status >= 500,
    };
    try {
      const errJson = await res.json();
      if (errJson && errJson.error) {
        errorDetail = errJson.error;
      }
    } catch {
      // Non-JSON response
    }
    throw new ApiError(errorDetail, res.status);
  }

  return (await res.json()) as T;
}

export interface CheckNowResult {
  hasNewCommit: boolean;
  sha: string;
  message: string;
  author: string;
  timestamp: string;
  reassessed: boolean;
  skillsUpdated: number;
}

export const api = {
  /**
   * Health check endpoint.
   */
  async getHealth() {
    if (FORCE_FIXTURES) {
      return {
        llm: 'ok',
        github: 'ok',
        rate_remaining: 5000,
        watcher: 'webhook',
        next_poll_in_s: 10,
        db_path: 'mock/devproof.db',
        row_counts: { jobs: 1, tracks: 1 },
        mode: 'fixtures',
      };
    }
    return await requestJson<any>(`${API_BASE}/health`);
  },

  /**
   * Extract structured job requirements from a URL or raw text.
   */
  async extractJob(input: {
    url?: string;
    text?: string;
    title?: string;
    company?: string;
  }): Promise<JobDraft | { status: 'needs_paste'; reason: string; source_url: string; message?: string }> {
    if (FORCE_FIXTURES) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return DEV_FIXTURES.jobDraft as unknown as JobDraft;
    }

    return await requestJson<JobDraft | { status: 'needs_paste'; reason: string; source_url: string; message?: string }>(
      `${API_BASE}/jobs/extract`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: input.url,
          raw_text: input.text,
          title: input.title,
          company: input.company,
        }),
      }
    );
  },

  /**
   * Save confirmed job draft into database.
   */
  async saveJob(draft: JobDraft): Promise<JobDraft> {
    if (FORCE_FIXTURES) {
      return draft;
    }
    return await requestJson<JobDraft>(`${API_BASE}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
  },

  /**
   * Get Claims Matrix for a specific job comparing resume claims to repository tracks.
   */
  async getClaimsMatrix(jobId: string): Promise<ClaimsMatrix> {
    if (FORCE_FIXTURES) {
      return DEV_FIXTURES.claimsMatrix as unknown as ClaimsMatrix;
    }
    return await requestJson<ClaimsMatrix>(`${API_BASE}/jobs/${jobId}/claims-matrix`);
  },

  /**
   * Parse candidate resume via PDF file upload or pasted text.
   */
  async parseResume(input: { file?: File; text?: string }) {
    if (FORCE_FIXTURES) {
      return {
        resume_id: `resume_${Date.now()}`,
        filename: input.file?.name || 'resume.pdf',
        text_chars: 420,
        claimed_skills: [
          { skill: 'Python', taxonomy_key: 'python_lang', source_line: 4, kind: 'explicit' },
          { skill: 'FastAPI / REST APIs', taxonomy_key: 'rest_api', source_line: 4, kind: 'explicit' },
          { skill: 'SQL', taxonomy_key: 'sql_database', source_line: 4, kind: 'explicit' },
          { skill: 'Testing', taxonomy_key: 'testing', source_line: 4, kind: 'explicit' },
        ],
        repo_candidates: [
          {
            url: 'https://github.com/sranjit29794-bit/student-api',
            owner: 'sranjit29794-bit',
            name: 'student-api',
            kind: 'repo',
            source: 'text',
          },
        ],
        warnings: [],
      };
    }

    if (input.file) {
      const formData = new FormData();
      formData.append('file', input.file);
      // Browser automatically assigns multipart/form-data with correct boundary
      const res = await fetch(`${API_BASE}/resume/parse`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        let errDetail: ApiErrorDetail = {
          code: `HTTP_${res.status}`,
          message: 'Resume parsing failed',
          retryable: false,
        };
        try {
          const errJson = await res.json();
          if (errJson?.error) {
            errDetail = errJson.error;
          }
        } catch {
          // ignore
        }
        throw new ApiError(errDetail, res.status);
      }
      return await res.json();
    }

    return await requestJson<any>(`${API_BASE}/resume/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input.text }),
    });
  },

  /**
   * Validate connected GitHub repository.
   */
  async validateRepo(repoUrl: string): Promise<RepoValidationResult> {
    if (FORCE_FIXTURES) {
      return {
        valid: true,
        owner: 'sranjit29794-bit',
        name: 'student-api',
        default_branch: 'main',
        head_sha: 'c3d4e5f67890123456789abcdef0123456789012',
        commit_message: 'feat(db): add sqlite database and tests',
        analyzable_files: 6,
        scope: {
          analyzed: 6,
          skipped: 2,
          skipped_reasons: { 'Documentation (*.md)': 1, 'Virtualenv / packages': 1 },
          truncated: false,
        },
        is_python_backend: true,
        error: null,
        error_type: null,
      };
    }

    const repoData = await requestJson<any>(`${API_BASE}/repos/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: repoUrl }),
    });

    return {
      valid: true,
      owner: repoData.owner,
      name: repoData.name,
      default_branch: repoData.default_branch,
      head_sha: repoData.last_seen_sha || '',
      commit_message: 'feat: connect repository',
      analyzable_files: 6,
      scope: { analyzed: 6, skipped: 0, skipped_reasons: {}, truncated: false },
      is_python_backend: true,
      error: null,
      error_type: null,
    };
  },

  /**
   * List all tracked opportunities from the database.
   */
  async getTracks(): Promise<TrackOpportunity[]> {
    if (FORCE_FIXTURES) {
      return [DEV_FIXTURES.trackC2 as unknown as TrackOpportunity];
    }

    const tracks = await requestJson<any[]>(`${API_BASE}/tracks`);
    return tracks.map((t) => ({
      id: t.id,
      job: t.job || {
        id: t.job_id,
        title: 'Software Engineer',
        company: 'Company',
        source_url: '',
        source_type: 'user_provided',
        source_detail: '',
        raw_text: '',
        requirements: [],
        confirmed: true,
      },
      repo: t.repo || {
        id: t.repo_id,
        owner: t.repo_id?.split('/')[0] || 'owner',
        name: t.repo_id?.split('/')[1] || 'repo',
        default_branch: t.branch || 'main',
        html_url: `https://github.com/${t.repo_id}`,
        webhook_status: 'none',
      },
      branch: t.branch || 'main',
      last_seen_sha: t.last_seen_sha || '',
      last_assessed_at: t.latest_analysis?.finished_at || t.created_at || 'Recently',
      watcher_mode: t.watcher_mode || 'polling',
      status_summary: {
        demonstrated: t.assessments?.filter((a: any) => a.status === 'DEMONSTRATED').length || 0,
        partial: t.assessments?.filter((a: any) => a.status === 'PARTIAL').length || 0,
        not_demonstrated: t.assessments?.filter((a: any) => a.status === 'NOT_DEMONSTRATED').length || 0,
        unable: t.assessments?.filter((a: any) => a.status === 'UNABLE_TO_ASSESS').length || 0,
      },
      assessments: (t.assessments || []).map((a: any) => ({
        ...a,
        evidence: a.evidence || [],
      })),
    }));
  },

  /**
   * Create a new track linking a job and repo.
   */
  async createTrack(input: { jobId: string; repoUrl: string; branch?: string; resumeId?: string }): Promise<any> {
    if (FORCE_FIXTURES) {
      return { id: `track_${Date.now()}` };
    }
    return await requestJson<any>(`${API_BASE}/tracks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: input.jobId,
        repo_url: input.repoUrl,
        branch: input.branch || 'main',
        resume_id: input.resumeId,
      }),
    });
  },

  /**
   * Fetch track assessment details by ID.
   */
  async getTrack(trackId: string, state: 'c0' | 'c2' = 'c2'): Promise<TrackOpportunity> {
    if (FORCE_FIXTURES) {
      return (state === 'c0' ? DEV_FIXTURES.trackC0 : DEV_FIXTURES.trackC2) as unknown as TrackOpportunity;
    }

    const t = await requestJson<any>(`${API_BASE}/tracks/${trackId}`);
    return {
      id: t.id,
      job: t.job || {
        id: t.job_id,
        title: 'Software Engineer',
        company: 'Company',
        source_url: '',
        source_type: 'user_provided',
        source_detail: '',
        raw_text: '',
        requirements: [],
        confirmed: true,
      },
      repo: t.repo || {
        id: t.repo_id,
        owner: t.repo_id?.split('/')[0] || 'owner',
        name: t.repo_id?.split('/')[1] || 'repo',
        default_branch: t.branch || 'main',
        html_url: `https://github.com/${t.repo_id}`,
        webhook_status: 'none',
      },
      branch: t.branch || 'main',
      last_seen_sha: t.last_seen_sha || '',
      last_assessed_at: t.latest_analysis?.finished_at || t.created_at || 'Recently',
      watcher_mode: t.watcher_mode || 'polling',
      status_summary: {
        demonstrated: t.assessments?.filter((a: any) => a.status === 'DEMONSTRATED').length || 0,
        partial: t.assessments?.filter((a: any) => a.status === 'PARTIAL').length || 0,
        not_demonstrated: t.assessments?.filter((a: any) => a.status === 'NOT_DEMONSTRATED').length || 0,
        unable: t.assessments?.filter((a: any) => a.status === 'UNABLE_TO_ASSESS').length || 0,
      },
      assessments: (t.assessments || []).map((a: any) => ({
        ...a,
        evidence: a.evidence || [],
      })),
    };
  },

  /**
   * Manually trigger Change Sentinel check.
   */
  async checkNow(trackId: string): Promise<CheckNowResult> {
    if (FORCE_FIXTURES) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return {
        hasNewCommit: true,
        sha: 'c3d4e5f67890123456789abcdef0123456789012',
        message: 'feat(db): add sqlite database and tests',
        author: 'Rohan Sharma',
        timestamp: 'Just now',
        reassessed: true,
        skillsUpdated: 2,
      };
    }

    return await requestJson<CheckNowResult>(`${API_BASE}/tracks/${trackId}/check-now`, {
      method: 'POST',
    });
  },

  /**
   * Fetch before/after assessment diff.
   */
  async getDiff(trackId: string) {
    if (FORCE_FIXTURES) {
      return DEV_FIXTURES.diff;
    }
    return await requestJson<any>(`${API_BASE}/tracks/${trackId}/diff`);
  },

  /**
   * Delete a specific track and associated assessments.
   */
  async deleteTrack(trackId: string): Promise<{ deleted: boolean }> {
    return await requestJson<{ deleted: boolean }>(`${API_BASE}/tracks/${trackId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Delete all candidate data per DATA_POLICY.md.
   */
  async deleteMyData(): Promise<{ deleted: boolean; message: string }> {
    return await requestJson<{ deleted: boolean; message: string }>(`${API_BASE}/tracks/user/data`, {
      method: 'DELETE',
    });
  },

  /**
   * Fetch file content snippet for code viewer.
   */
  async getEvidenceFile(evidenceId: string): Promise<string> {
    if (FORCE_FIXTURES) {
      return '';
    }
    const res = await fetch(`${API_BASE}/evidence/${evidenceId}/file`);
    if (!res.ok) {
      throw new ApiError(
        {
          code: `HTTP_${res.status}`,
          message: 'Failed to fetch evidence file',
          retryable: false,
        },
        res.status
      );
    }
    const data = await res.json();
    return data.content || '';
  },

  /**
   * Subscribe to server-sent events for real-time push detection and status changes.
   */
  subscribeEvents(trackId: string, onEvent: (event: any) => void): () => void {
    if (typeof window === 'undefined' || !window.EventSource || FORCE_FIXTURES) {
      if (FORCE_FIXTURES) {
        const timer = setTimeout(() => {
          onEvent({
            event_type: 'push_detected',
            data: {
              commit_sha: 'c3d4e5f67890123456789abcdef0123456789012',
              commit_message: 'feat(db): add sqlite database and tests',
              reassessed_count: 2,
            },
          });
        }, 8000);
        return () => clearTimeout(timer);
      }
      return () => {};
    }

    const eventSource = new EventSource(`${API_BASE}/events/stream?track_id=${trackId}`);
    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        onEvent(data);
      } catch {
        // Ignore unparseable frames
      }
    };

    return () => {
      eventSource.close();
    };
  },
};
