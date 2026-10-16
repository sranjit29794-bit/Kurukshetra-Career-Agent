import React, { useState } from 'react';
import type {
  ErrorDetail,
  ErrorResponse,
  JobDraft,
  JobExtractRequest,
  Priority,
  RepoConnectResult,
  RequirementDraft,
  TrackDetail,
} from '../types/contract';
import { API_BASE } from '../api/config';

interface CareerTrackProps {
  onNavigate?: (route: string) => void;
}

export const CareerTrack: React.FC<CareerTrackProps> = ({ onNavigate }) => {
  // 3-Stage Workflow: 1: Ingest Job -> 2: Confirm Requirements -> 3: Link Repo & Pin SHA -> 4: Track Ready
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Job Ingestion State
  const [inputMode, setInputMode] = useState<'url' | 'text'>('text');
  const [jobUrl, setJobUrl] = useState('');
  const [jobText, setJobText] = useState(
    'NovaPay Financial is seeking a Backend Engineering Intern.\nResponsibilities:\n- Design and implement high-performance RESTful APIs using Python frameworks (FastAPI/Flask).\n- Proficiency in SQL query optimization and relational schema design.\n- Write automated unit and integration tests with pytest to maintain coverage.\n- Experience deploying services with Docker containers is a plus.'
  );
  const [extractLoading, setExtractLoading] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  // Review & Confirmation State
  const [jobDraft, setJobDraft] = useState<JobDraft | null>(null);
  const [jobTitle, setJobTitle] = useState('');
  const [jobCompany, setJobCompany] = useState('');
  const [requirements, setRequirements] = useState<RequirementDraft[]>([]);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // New requirement manual entry state
  const [newReqName, setNewReqName] = useState('');
  const [newReqCategory, setNewReqCategory] = useState('Backend Engineering');
  const [newReqPriority, setNewReqPriority] = useState<Priority>('must');

  // Repo Connection State
  const [repoUrl, setRepoUrl] = useState('https://github.com/fastapi/fastapi');
  const [repoLoading, setRepoLoading] = useState(false);
  const [repoErrorDetail, setRepoErrorDetail] = useState<ErrorDetail | null>(null);
  const [repoResult, setRepoResult] = useState<RepoConnectResult | null>(null);

  // Track Creation State
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [persistedTrack, setPersistedTrack] = useState<TrackDetail | null>(null);

  // 1. Submit Job Ingestion
  const handleExtractJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setExtractLoading(true);
    setExtractError(null);

    const payload: JobExtractRequest =
      inputMode === 'url' ? { url: jobUrl.trim() } : { text: jobText.trim() };

    try {
      const res = await fetch(`${API_BASE}/api/jobs/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        const err = data as ErrorResponse;
        throw new Error(err.error?.message || `Extraction failed (${res.status})`);
      }

      const draft = data as JobDraft;
      setJobDraft(draft);
      setJobTitle(draft.title);
      setJobCompany(draft.company);
      setRequirements(draft.requirements);
      setCurrentStep(2);
    } catch (err: any) {
      setExtractError(err.message || 'An unexpected error occurred during job extraction.');
    } finally {
      setExtractLoading(false);
    }
  };

  // 2. Requirement Manipulation
  const handleUpdateRequirement = (index: number, field: keyof RequirementDraft, value: any) => {
    setRequirements((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleDeleteRequirement = (index: number) => {
    setRequirements((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddRequirement = () => {
    if (!newReqName.trim()) return;
    const newReq: RequirementDraft = {
      name: newReqName.trim(),
      category: newReqCategory.trim() || 'Backend Engineering',
      priority: newReqPriority,
      source_sentence: 'Candidate-defined custom requirement',
      search_terms: [newReqName.trim().toLowerCase()],
      position: requirements.length + 1,
    };
    setRequirements((prev) => [...prev, newReq]);
    setNewReqName('');
  };

  const handleConfirmRequirements = async () => {
    if (!jobDraft?.id) return;
    setConfirmLoading(true);
    setConfirmError(null);

    try {
      const res = await fetch(`${API_BASE}/api/jobs/${jobDraft.id}/confirm`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: jobTitle.trim(),
          company: jobCompany.trim(),
          requirements,
          confirmed: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const err = data as ErrorResponse;
        throw new Error(err.error?.message || 'Failed to confirm requirements.');
      }

      setJobDraft(data as JobDraft);
      setCurrentStep(3);
    } catch (err: any) {
      setConfirmError(err.message || 'Confirmation error.');
    } finally {
      setConfirmLoading(false);
    }
  };

  // 3. Connect Public Repository
  const handleConnectRepo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setRepoLoading(true);
    setRepoErrorDetail(null);
    setRepoResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/repos/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: repoUrl.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        const err = data.error || {
          code: `HTTP_${res.status}`,
          message: data.message || 'Failed to connect repository.',
          retryable: res.status >= 500,
          reset_epoch: data.reset_epoch || null,
        };
        setRepoErrorDetail(err);
        return;
      }

      setRepoResult(data as RepoConnectResult);
    } catch (err: any) {
      setRepoErrorDetail({
        code: 'NETWORK_ERROR',
        message: err.message || 'Failed to connect to repository service.',
        retryable: true,
      });
    } finally {
      setRepoLoading(false);
    }
  };

  // 4. Save and Bind Persistent Track
  const handleCreateTrack = async () => {
    if (!jobDraft?.id || !repoResult?.id) return;

    setTrackLoading(true);
    setTrackError(null);

    try {
      const res = await fetch(`${API_BASE}/api/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobDraft.id,
          repo_id: repoResult.id,
          branch: repoResult.default_branch,
          head_sha: repoResult.head_sha,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const err = data as ErrorResponse;
        throw new Error(err.error?.message || 'Failed to create track.');
      }

      setPersistedTrack(data as TrackDetail);
      setCurrentStep(4);
    } catch (err: any) {
      setTrackError(err.message || 'Error creating persistent track.');
    } finally {
      setTrackLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1080px', margin: '0 auto', padding: '36px 24px' }}>
      {/* Top Workflow Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Setup Wizard
          </span>
          <span style={{ color: 'var(--text-dim)' }}>/</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Career Track Ingestion</span>
        </div>
        <h1 style={{ fontSize: '30px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-main)', margin: '0 0 8px 0' }}>
          Create Evidence-Backed Track
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', margin: 0, maxWidth: '720px', lineHeight: '1.6' }}>
          Ingest engineering requirements from a target job description, link a real GitHub repository, pin an exact immutable commit SHA, and persist the evaluation pipeline.
        </p>
      </div>

      {/* Step Indicators Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
          marginBottom: '32px',
        }}
      >
        {[
          { num: 1, title: 'Job Ingestion', desc: 'Paste text or public URL' },
          { num: 2, title: 'Review Requirements', desc: 'Confirm parsed skills' },
          { num: 3, title: 'Link Repository', desc: 'Pin commit SHA & persist' },
        ].map((s) => {
          const isActive = currentStep === s.num;
          const isDone = currentStep > s.num;
          return (
            <div
              key={s.num}
              style={{
                backgroundColor: isActive ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                border: isActive
                  ? '2px solid var(--accent-cyan)'
                  : isDone
                  ? '1px solid var(--accent-emerald)'
                  : '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.2s ease',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: isDone ? 'var(--accent-emerald)' : isActive ? 'var(--accent-cyan)' : 'var(--bg-surface-card)',
                  color: isDone || isActive ? '#080c14' : 'var(--text-dim)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  fontWeight: 800,
                }}
              >
                {isDone ? '✓' : s.num}
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: isActive ? 'var(--text-main)' : isDone ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                  {s.title}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{s.desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* STEP 1: JOB INGESTION */}
      {currentStep === 1 && (
        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)', padding: '28px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              1. Job Description Source
            </h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                data-testid="input-mode-text"
                onClick={() => setInputMode('text')}
                style={{
                  backgroundColor: inputMode === 'text' ? 'var(--bg-surface-elevated)' : 'transparent',
                  color: inputMode === 'text' ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  border: inputMode === 'text' ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                Direct Text Input
              </button>
              <button
                type="button"
                data-testid="input-mode-url"
                onClick={() => setInputMode('url')}
                style={{
                  backgroundColor: inputMode === 'url' ? 'var(--bg-surface-elevated)' : 'transparent',
                  color: inputMode === 'url' ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  border: inputMode === 'url' ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                Public Job URL
              </button>
            </div>
          </div>

          <form onSubmit={handleExtractJob}>
            {inputMode === 'url' ? (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Public Job Posting URL
                </label>
                <input
                  type="url"
                  placeholder="https://jobs.example.com/posting/backend-intern"
                  value={jobUrl}
                  onChange={(e) => setJobUrl(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-card)',
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-main)',
                    fontSize: '14px',
                  }}
                />
              </div>
            ) : (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Job Description Text
                </label>
                <textarea
                  rows={8}
                  placeholder="Paste the job description text here..."
                  value={jobText}
                  onChange={(e) => setJobText(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-card)',
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-main)',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    fontFamily: 'var(--font-sans)',
                  }}
                />
              </div>
            )}

            {extractError && (
              <div style={{ backgroundColor: 'var(--accent-rose-glow)', border: '1px solid var(--accent-rose)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: '20px', color: 'var(--accent-rose)', fontSize: '13px' }}>
                <strong>Extraction Error:</strong> {extractError}
              </div>
            )}

            <button
              type="submit"
              data-testid="parse-requirements-btn"
              disabled={extractLoading || (inputMode === 'url' ? !jobUrl.trim() : !jobText.trim())}
              style={{
                backgroundColor: 'var(--accent-cyan)',
                color: '#080c14',
                border: 'none',
                padding: '12px 24px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {extractLoading ? (
                <>
                  <span className="live-pulse">↻</span>
                  <span>Extracting Skills...</span>
                </>
              ) : (
                <>
                  <span>Parse Engineering Requirements</span>
                  <span>→</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* STEP 2: REVIEW & CONFIRM REQUIREMENTS */}
      {currentStep === 2 && (
        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)', padding: '28px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              2. Review & Refine Requirements
            </h2>
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid var(--border-card)',
                color: 'var(--text-muted)',
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              ← Edit Job Source
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 700 }}>
                Role / Title
              </label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-card)',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-main)',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 700 }}>
                Hiring Organization / Company
              </label>
              <input
                type="text"
                value={jobCompany}
                onChange={(e) => setJobCompany(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-card)',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-main)',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              />
            </div>
          </div>

          {/* Requirements List */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '12px' }}>
              Extracted Engineering Requirements ({requirements.length})
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {requirements.map((req, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono, monospace' }}>
                      #{idx + 1}
                    </span>
                    <input
                      type="text"
                      value={req.name}
                      onChange={(e) => handleUpdateRequirement(idx, 'name', e.target.value)}
                      style={{
                        flex: 1,
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: 'var(--text-main)',
                        fontWeight: 600,
                        fontSize: '14px',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <select
                      value={req.priority}
                      onChange={(e) => handleUpdateRequirement(idx, 'priority', e.target.value as Priority)}
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        color: req.priority === 'must' ? 'var(--accent-rose)' : 'var(--accent-emerald)',
                        border: '1px solid var(--border-card)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '4px 8px',
                        fontSize: '12px',
                        fontWeight: 700,
                      }}
                    >
                      <option value="must">MUST HAVE</option>
                      <option value="nice">NICE TO HAVE</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => handleDeleteRequirement(idx)}
                      style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: 'var(--accent-rose)',
                        fontSize: '16px',
                        padding: '4px 8px',
                      }}
                      title="Remove requirement"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add Custom Requirement */}
          <div style={{ backgroundColor: 'var(--bg-surface-card)', border: '1px dashed var(--border-card)', borderRadius: 'var(--radius-sm)', padding: '16px', marginBottom: '24px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '10px' }}>
              + Add Custom Requirement
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '10px' }}>
              <input
                type="text"
                placeholder="Requirement Name (e.g. Asynchronous Messaging)"
                value={newReqName}
                onChange={(e) => setNewReqName(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-card)',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                }}
              />
              <input
                type="text"
                placeholder="Category"
                value={newReqCategory}
                onChange={(e) => setNewReqCategory(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-card)',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                }}
              />
              <select
                value={newReqPriority}
                onChange={(e) => setNewReqPriority(e.target.value as Priority)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-card)',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                }}
              >
                <option value="must">Must Have</option>
                <option value="nice">Nice to Have</option>
              </select>
              <button
                type="button"
                onClick={handleAddRequirement}
                style={{
                  backgroundColor: 'var(--accent-cyan)',
                  color: '#080c14',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 700,
                  fontSize: '13px',
                }}
              >
                Add
              </button>
            </div>
          </div>

          {confirmError && (
            <div style={{ backgroundColor: 'var(--accent-rose-glow)', border: '1px solid var(--accent-rose)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: '20px', color: 'var(--accent-rose)', fontSize: '13px' }}>
              <strong>Confirmation Error:</strong> {confirmError}
            </div>
          )}

          <button
            type="button"
            onClick={handleConfirmRequirements}
            disabled={confirmLoading || requirements.length === 0}
            style={{
              backgroundColor: 'var(--accent-emerald)',
              color: '#080c14',
              border: 'none',
              padding: '12px 24px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 700,
              fontSize: '14px',
            }}
          >
            {confirmLoading ? 'Confirming...' : 'Confirm Requirements & Proceed to Repo Connection →'}
          </button>
        </div>
      )}

      {/* STEP 3: LINK GITHUB REPOSITORY & PIN COMMIT */}
      {currentStep === 3 && (
        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)', padding: '28px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              3. Connect Candidate GitHub Repository
            </h2>
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid var(--border-card)',
                color: 'var(--text-muted)',
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              ← Edit Requirements
            </button>
          </div>

          <form onSubmit={handleConnectRepo} style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
              Public GitHub Repository URL
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                placeholder="https://github.com/owner/repository"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                required
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-card)',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-main)',
                  fontSize: '14px',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              />
              <button
                type="submit"
                disabled={repoLoading || !repoUrl.trim()}
                style={{
                  padding: '12px 22px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  backgroundColor: repoLoading ? 'var(--text-dim)' : 'var(--accent-cyan)',
                  color: '#080c14',
                  fontWeight: 700,
                  fontSize: '14px',
                  whiteSpace: 'nowrap',
                }}
              >
                {repoLoading ? 'Resolving SHA...' : 'Connect & Pin SHA'}
              </button>
            </div>

            {/* Quick Demo Repositories */}
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Demo Repositories:</span>
              {[
                { label: 'fastapi (Real Python)', url: 'https://github.com/fastapi/fastapi' },
                { label: 'octocat/Hello-World', url: 'https://github.com/octocat/Hello-World' },
              ].map((r) => (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => setRepoUrl(r.url)}
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--accent-cyan)',
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </form>

          {/* DEDICATED RATE LIMIT & RECOVERY ALERT CARD */}
          {repoErrorDetail && (
            <div
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--accent-rose)',
                borderRadius: 'var(--radius-md)',
                padding: '20px',
                marginBottom: '24px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '20px', color: 'var(--accent-rose)' }}>⚠️</span>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-rose)', margin: 0 }}>
                      GitHub Connection Failed: [{repoErrorDetail.code}]
                    </h3>
                    <div style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '4px' }}>
                      {repoErrorDetail.message}
                    </div>
                  </div>
                </div>

                {repoErrorDetail.retryable && (
                  <button
                    onClick={() => handleConnectRepo()}
                    disabled={repoLoading}
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-card)',
                      color: 'var(--text-main)',
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    Retry Connection
                  </button>
                )}
              </div>

              {/* Specific Rate Limit Handling */}
              {(repoErrorDetail.code === 'GITHUB_RATE_LIMITED' || repoErrorDetail.code === 'RATE_LIMIT_EXCEEDED' || repoErrorDetail.message.includes('rate limit')) && (
                <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', padding: '14px 18px', borderLeft: '4px solid var(--accent-amber)', marginTop: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-amber)', marginBottom: '4px' }}>
                    Rate Limit Guidance & Reset Info
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '8px' }}>
                    GitHub restricts unauthenticated REST requests to <strong>60 requests per hour per IP</strong>.
                    {repoErrorDetail.reset_epoch ? (
                      <span>
                        {' '}The quota will reset at <strong>{new Date(repoErrorDetail.reset_epoch * 1000).toLocaleTimeString()}</strong>.
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)', lineHeight: '1.5' }}>
                    💡 <strong>To bypass this limit:</strong> Add a server-side <code>GITHUB_TOKEN=ghp_...</code> into <code>backend/.env</code> and restart the backend for 5,000 requests/hour. (Never paste tokens in client fields).
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Repo Connection Success & Pinned SHA */}
          {repoResult && (
            <div style={{ backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--accent-emerald)', borderRadius: 'var(--radius-md)', padding: '20px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <span style={{ color: 'var(--accent-emerald)', fontSize: '18px' }}>✓</span>
                <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
                  {repoResult.owner}/{repoResult.name}
                </span>
                <span style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '2px 8px', fontSize: '12px', color: 'var(--accent-cyan)' }}>
                  branch: {repoResult.default_branch}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                <span>Pinned Commit SHA:</span>
                <code style={{ backgroundColor: 'var(--bg-surface)', padding: '4px 8px', borderRadius: 'var(--radius-sm)', color: 'var(--accent-emerald)', fontSize: '12px' }}>
                  {repoResult.head_sha}
                </code>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                Analyzed Scope: <strong>{repoResult.scope.analyzed} files</strong> ({repoResult.scope.skipped} skipped by security boundaries)
              </div>
            </div>
          )}

          {trackError && (
            <div style={{ backgroundColor: 'var(--accent-rose-glow)', border: '1px solid var(--accent-rose)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: '20px', color: 'var(--accent-rose)', fontSize: '13px' }}>
              <strong>Error creating track:</strong> {trackError}
            </div>
          )}

          <button
            type="button"
            onClick={handleCreateTrack}
            disabled={trackLoading || !repoResult?.id}
            style={{
              backgroundColor: 'var(--accent-cyan)',
              color: '#080c14',
              border: 'none',
              padding: '12px 24px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 700,
              fontSize: '14px',
            }}
          >
            {trackLoading ? 'Persisting Track...' : 'Save & Launch Track Pipeline →'}
          </button>
        </div>
      )}

      {/* STEP 4: TRACK CREATED CONFIRMATION */}
      {currentStep === 4 && persistedTrack && (
        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--accent-emerald)', borderRadius: 'var(--radius-lg)', padding: '36px 28px', textAlign: 'center', boxShadow: 'var(--shadow-md)' }}>
          <div style={{ fontSize: '42px', marginBottom: '12px' }}>🎉</div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
            Career Track #{persistedTrack.id} Successfully Persisted!
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '520px', margin: '0 auto 24px auto', lineHeight: '1.6' }}>
            The target job requirements and candidate repository are now permanently linked and actively monitored by the background sentinel.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px' }}>
            <button
              onClick={() => onNavigate && onNavigate(`/tracks/${persistedTrack.id}`)}
              style={{
                backgroundColor: 'var(--accent-cyan)',
                color: '#080c14',
                border: 'none',
                padding: '12px 24px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                fontSize: '14px',
              }}
            >
              Open Track & Run Assessment →
            </button>
            <button
              onClick={() => onNavigate && onNavigate('/')}
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-card)',
                color: 'var(--text-main)',
                padding: '12px 20px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                fontSize: '14px',
              }}
            >
              Return to Console
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
