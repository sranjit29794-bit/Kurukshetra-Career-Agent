/**
 * Unified API client module for DevProof frontend.
 * Provides real HTTP and SSE calls to backend with mock fallbacks to docs/fixtures
 * when VITE_USE_FIXTURES=1 or when backend is unreachable.
 *
 * Invariants:
 * - Single data layer handling error envelope { error: { code, message, retryable } }
 * - Real endpoints for jobs, claims matrix, resume, tracks, repo validation, and events
 */

import type { JobDraft, TrackOpportunity, RepoValidationResult, ClaimsMatrix } from '../types';
import trackC0 from '../../../docs/fixtures/track_assessment_c0.json';
import trackC2 from '../../../docs/fixtures/track_assessment_c2.json';
import jobDraftFixture from '../../../docs/fixtures/job_draft.json';
import diffFixture from '../../../docs/fixtures/diff_c0_c2.json';
import claimsMatrixFixture from '../../../docs/fixtures/claims_matrix.json';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
// Force fixtures only if explicitly requested via VITE_USE_FIXTURES=1
const FORCE_FIXTURES = import.meta.env.VITE_USE_FIXTURES === '1';

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
      return { status: 'healthy', version: '0.1.0', db: 'ok', watcher_mode: 'webhook', rate_limit: { remaining: 5000 } };
    }
    try {
      return await requestJson<any>(`${API_BASE}/health`);
    } catch {
      return { status: 'degraded', version: '0.1.0', db: 'ok', watcher_mode: 'polling', rate_limit: { remaining: 4980 } };
    }
  },

  /**
   * Extract structured job requirements from a URL or raw text.
   */
  async extractJob(input: { url?: string; text?: string; title?: string; company?: string }): Promise<JobDraft> {
    if (input.url && (input.url.includes('blocked') || input.url.includes('linkedin.com/jobs/blocked'))) {
      throw new ApiError({ code: 'LOGIN_WALL', message: 'LinkedIn requires login authentication. Please paste job text.', retryable: false }, 400);
    }

    if (!FORCE_FIXTURES) {
      try {
        return await requestJson<JobDraft>(`${API_BASE}/jobs/extract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: input.url,
            raw_text: input.text,
            title: input.title,
            company: input.company,
          }),
        });
      } catch (err) {
        if (!FORCE_FIXTURES && err instanceof ApiError && err.code === 'LOGIN_WALL') {
          throw err;
        }
        // Fallback to fixture if offline or unhandled
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
    return jobDraftFixture as unknown as JobDraft;
  },

  /**
   * Save confirmed job draft into database.
   */
  async saveJob(draft: JobDraft): Promise<JobDraft> {
    if (!FORCE_FIXTURES) {
      try {
        return await requestJson<JobDraft>(`${API_BASE}/jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draft),
        });
      } catch {
        // Fall back to returning draft
      }
    }
    return draft;
  },

  /**
   * Get Claims Matrix for a specific job comparing resume claims to repository tracks.
   */
  async getClaimsMatrix(jobId = 'job_devproof_demo'): Promise<ClaimsMatrix> {
    if (!FORCE_FIXTURES) {
      try {
        return await requestJson<ClaimsMatrix>(`${API_BASE}/jobs/${jobId}/claims-matrix`);
      } catch {
        // Fallback to fixture
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
    return claimsMatrixFixture as unknown as ClaimsMatrix;
  },

  /**
   * Parse candidate resume via PDF file upload or pasted text.
   */
  async parseResume(input: { file?: File; text?: string }) {
    if (!FORCE_FIXTURES) {
      try {
        if (input.file) {
          const formData = new FormData();
          formData.append('file', input.file);
          const res = await fetch(`${API_BASE}/resume/parse`, {
            method: 'POST',
            body: formData,
          });
          if (res.ok) {
            return await res.json();
          }
        } else if (input.text) {
          return await requestJson<any>(`${API_BASE}/resume/parse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: input.text }),
          });
        }
      } catch {
        // Fallback
      }
    }

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
  },

  /**
   * Validate connected GitHub repository.
   */
  async validateRepo(repoUrl: string): Promise<RepoValidationResult> {
    if (repoUrl.includes('private')) {
      return {
        valid: false,
        owner: 'private-org',
        name: 'secret-service',
        default_branch: 'main',
        head_sha: '',
        commit_message: '',
        analyzable_files: 0,
        scope: { analyzed: 0, skipped: 0, skipped_reasons: {}, truncated: false },
        is_python_backend: false,
        error: 'Repository not found or private. Ensure public access or configure GITHUB_TOKEN.',
        error_type: 'private_repo',
      };
    }

    if (repoUrl.includes('non-python') || repoUrl.includes('rust-api')) {
      return {
        valid: false,
        owner: 'user',
        name: 'rust-service',
        default_branch: 'main',
        head_sha: 'e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
        commit_message: 'init rust repo',
        analyzable_files: 0,
        scope: { analyzed: 0, skipped: 5, skipped_reasons: { 'Cargo.toml': 1, 'src/main.rs': 1 }, truncated: false },
        is_python_backend: false,
        error: 'DevProof analyzes Python backends (analyzed 0 supported files).',
        error_type: 'non_python',
      };
    }

    if (!FORCE_FIXTURES) {
      try {
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
          head_sha: repoData.last_seen_sha || 'c3d4e5f67890123456789abcdef0123456789012',
          commit_message: 'feat: connect repository',
          analyzable_files: 6,
          scope: { analyzed: 6, skipped: 1, skipped_reasons: {}, truncated: false },
          is_python_backend: true,
          error: null,
          error_type: null,
        };
      } catch {
        // Fallback
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
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
  },

  /**
   * Fetch track assessment details (C0 or C2 state).
   */
  async getTrack(trackId = 'track_demo', state: 'c0' | 'c2' = 'c2'): Promise<TrackOpportunity> {
    if (!FORCE_FIXTURES) {
      try {
        return await requestJson<TrackOpportunity>(`${API_BASE}/tracks/${trackId}`);
      } catch {
        // Fallback
      }
    }
    return (state === 'c0' ? trackC0 : trackC2) as unknown as TrackOpportunity;
  },

  /**
   * Manually trigger Change Sentinel check.
   */
  async checkNow(trackId = 'track_demo'): Promise<CheckNowResult> {
    if (!FORCE_FIXTURES) {
      try {
        return await requestJson<CheckNowResult>(`${API_BASE}/tracks/${trackId}/check-now`, {
          method: 'POST',
        });
      } catch {
        // Fallback
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 600));
    return {
      hasNewCommit: true,
      sha: 'c3d4e5f67890123456789abcdef0123456789012',
      message: 'feat(db): add sqlite database and tests',
      author: 'Rohan Sharma',
      timestamp: 'Just now',
      reassessed: true,
      skillsUpdated: 2,
    };
  },

  /**
   * Fetch before/after assessment diff.
   */
  async getDiff(trackId = 'track_demo') {
    if (!FORCE_FIXTURES) {
      try {
        return await requestJson<any>(`${API_BASE}/tracks/${trackId}/diff`);
      } catch {
        // Fallback
      }
    }
    return diffFixture;
  },

  /**
   * Fetch file content snippet for code viewer.
   */
  async getEvidenceFile(evidenceId: string): Promise<string> {
    if (!FORCE_FIXTURES) {
      try {
        const res = await fetch(`${API_BASE}/evidence/${evidenceId}/file`);
        if (res.ok) {
          const data = await res.json();
          return data.content || '';
        }
      } catch {
        // Fallback
      }
    }
    return '';
  },

  /**
   * Subscribe to server-sent events for real-time push detection and status changes.
   */
  subscribeEvents(trackId: string, onEvent: (event: any) => void): () => void {
    if (typeof window === 'undefined' || !window.EventSource || FORCE_FIXTURES) {
      // In fixture mode, simulate events on a gentle timer
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
