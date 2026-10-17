import React, { useState, useEffect } from 'react';
import {
  Globe,
  Plus,
  Trash2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  GitBranch,
  Loader2,
  Upload,
  FileText,
  CheckCircle2,
  Table,
  Search,
  GitFork,
  Archive,
} from 'lucide-react';
import type { JobDraft, Requirement, SourceType, ResumeDraftData, DroppedRequirement } from '../types';
import { StepperHeader, type StepItem } from './StepperHeader';
import { SourceBadge } from './SourceBadge';
import { SkillIconTile } from './SkillIconTile';
import { InfoBanner } from './InfoBanner';
import { api } from '../lib/api';

interface AddJobWizardProps {
  onComplete: (job: JobDraft, repoUrl: string) => void;
  onCancel: () => void;
  onViewClaimsMatrix?: (jobId: string) => void;
}

const WIZARD_STEPS: StepItem[] = [
  { id: 1, label: 'Job' },
  { id: 2, label: 'Resume' },
  { id: 3, label: 'Repositories' },
  { id: 4, label: 'Analysis' },
];

export interface RepoSelectorItem {
  id: string;
  name: string;
  fullName: string;
  owner: string;
  url: string;
  description: string;
  language: string;
  fork: boolean;
  archived: boolean;
  pushed_at?: string | null;
}

export const AddJobWizard: React.FC<AddJobWizardProps> = ({
  onComplete,
  onCancel,
  onViewClaimsMatrix,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // --- Step 1 State: Job Source & Requirements ---
  const [sourceType, setSourceType] = useState<SourceType>('fetched');
  const [jobUrl, setJobUrl] = useState<string>('');
  const [jobText, setJobText] = useState<string>('');
  const [jobTitle, setJobTitle] = useState<string>('');
  const [jobCompany, setJobCompany] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [extractionMode, setExtractionMode] = useState<string | null>(null);
  const [droppedRequirements, setDroppedRequirements] = useState<DroppedRequirement[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);

  // --- Step 2 State: Resume ---
  const [resumeMode, setResumeMode] = useState<'upload' | 'paste'>('upload');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumePasteText, setResumePasteText] = useState<string>('');
  const [isParsingResume, setIsParsingResume] = useState<boolean>(false);
  const [isScannedPdfWarning, setIsScannedPdfWarning] = useState<boolean>(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [resumeSuccessMessage, setResumeSuccessMessage] = useState<string | null>(null);
  const [parsedResume, setParsedResume] = useState<ResumeDraftData>({
    status: 'ok',
    resume_id: '',
    filename: '',
    text_chars: 0,
    claimed_skills: [],
    repo_candidates: [],
    warnings: [],
  });

  // --- Step 3 State: Repositories ---
  const [githubUsername, setGithubUsername] = useState<string>('');
  const [userRepos, setUserRepos] = useState<RepoSelectorItem[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState<boolean>(false);
  const [repoFetchError, setRepoFetchError] = useState<string | null>(null);
  const [repoSearchQuery, setRepoSearchQuery] = useState<string>('');
  const [customRepoUrl, setCustomRepoUrl] = useState<string>('');
  const [isConnectingCustom, setIsConnectingCustom] = useState<boolean>(false);
  const [customRepoError, setCustomRepoError] = useState<string | null>(null);
  const [selectedRepoFullNames, setSelectedRepoFullNames] = useState<string[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<Record<string, string>>({});
  const [repoScopeReports, setRepoScopeReports] = useState<
    Record<string, { analyzed: number; skipped: number; head_sha: string; branch: string; error?: string }>
  >({});

  // --- Step 4 State: Analysis Checklist Progress ---
  const [analysisStage, setAnalysisStage] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  // Handle URL fetch via real backend endpoint
  const handleFetchRequirements = async () => {
    if (!jobUrl.trim()) return;
    setIsExtracting(true);
    setExtractionError(null);

    // If LinkedIn URL, prompt user to paste text directly per BRAIN §11
    if (jobUrl.toLowerCase().includes('linkedin.com')) {
      setSourceType('user_provided');
      setExtractionError(
        'LinkedIn prevents automated scraping. Please copy and paste the job posting text below.'
      );
      setIsExtracting(false);
      return;
    }

    try {
      const res = await api.extractJob({ url: jobUrl.trim() });
      if ('status' in res && res.status === 'needs_paste') {
        setSourceType('user_provided');
        setExtractionError(
          'Target job site requires manual authentication. Switched to manual paste mode. Your source URL is preserved.'
        );
      } else {
        const draft = res as JobDraft;
        setSourceType('fetched');
        setExtractionError(null);
        if (draft.title) setJobTitle(draft.title);
        if (draft.company) setJobCompany(draft.company);
        if (draft.extraction_mode) {
          setExtractionMode(draft.extraction_mode);
        }
        if (draft.dropped) {
          setDroppedRequirements(draft.dropped);
        }
        if (draft.requirements && draft.requirements.length > 0) {
          setRequirements(draft.requirements);
        }
        if (draft.raw_text) {
          setJobText(draft.raw_text);
        }
      }
    } catch (err: unknown) {
      setSourceType('user_provided');
      const msg = err instanceof Error ? err.message : 'Login authentication required or fetch blocked.';
      setExtractionError(
        `${msg} Switched to manual paste mode. Your source URL is preserved.`
      );
    } finally {
      setIsExtracting(false);
    }
  };

  // Handle extracting requirements from pasted text
  const handleExtractPastedText = async () => {
    if (!jobText.trim()) return;
    setIsExtracting(true);
    setExtractionError(null);

    try {
      const res = await api.extractJob({
        text: jobText.trim(),
        url: jobUrl.trim(),
        title: jobTitle.trim(),
        company: jobCompany.trim(),
      });
      if ('status' in res && res.status === 'needs_paste') {
        setSourceType('user_provided');
      } else {
        const draft = res as JobDraft;
        setSourceType('user_provided');
        setExtractionError(null);
        if (draft.title && !jobTitle) setJobTitle(draft.title);
        if (draft.company && !jobCompany) setJobCompany(draft.company);
        if (draft.extraction_mode) {
          setExtractionMode(draft.extraction_mode);
        }
        if (draft.dropped) {
          setDroppedRequirements(draft.dropped);
        }
        if (draft.requirements && draft.requirements.length > 0) {
          setRequirements(draft.requirements);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to extract requirements from text.';
      setExtractionError(msg);
    } finally {
      setIsExtracting(false);
    }
  };

  // Step 4 analysis ready state
  useEffect(() => {
    if (step === 4) {
      setAnalysisStage(4);
      setIsFinished(true);
    }
  }, [step]);

  const handleUpdateRequirement = (id: string, updates: Partial<Requirement>) => {
    setRequirements((prev) =>
      prev.map((req) => (req.id === id ? { ...req, ...updates } : req))
    );
  };

  const handleDeleteRequirement = (id: string) => {
    setRequirements((prev) => prev.filter((req) => req.id !== id));
  };

  const handleAddRequirement = () => {
    const newId = `req_custom_${Date.now()}`;
    const newReq: Requirement = {
      id: newId,
      name: 'New Requirement',
      category: 'General',
      priority: 'must',
      source_sentence: 'Candidate specified requirement.',
      search_terms: [],
      position: requirements.length + 1,
    };
    setRequirements((prev) => [...prev, newReq]);
  };

  const processResumeFile = async (file: File) => {
    setIsParsingResume(true);
    setIsScannedPdfWarning(false);
    setResumeError(null);
    setResumeSuccessMessage(null);
    try {
      const data = await api.parseResume({ file });
      if (
        data.status === 'no_text' ||
        (data.warnings &&
          data.warnings.some(
            (w: string) =>
              w.toLowerCase().includes('scanned') ||
              w.toLowerCase().includes('selectable')
          ))
      ) {
        setIsScannedPdfWarning(true);
      } else {
        setIsScannedPdfWarning(false);
        setResumeSuccessMessage(`Successfully parsed ${file.name} (${data.claimed_skills.length} skills identified)`);
      }
      setParsedResume(data);
      if (data.repo_candidates && data.repo_candidates.length > 0) {
        const primary = data.repo_candidates[0];
        if (primary.owner) {
          setGithubUsername(primary.owner);
        }
      }
    } catch (err: any) {
      console.error('Failed to parse resume:', err);
      setResumeError(err.message || 'Failed to upload and parse resume PDF. Please verify file format or paste text.');
    } finally {
      setIsParsingResume(false);
    }
  };

  const processResumeText = async () => {
    if (!resumePasteText.trim()) return;
    setIsParsingResume(true);
    setIsScannedPdfWarning(false);
    setResumeError(null);
    setResumeSuccessMessage(null);
    try {
      const data = await api.parseResume({ text: resumePasteText });
      if (data.status === 'no_text') {
        setIsScannedPdfWarning(true);
      } else {
        setIsScannedPdfWarning(false);
        setResumeSuccessMessage(`Successfully extracted ${data.claimed_skills.length} skills from resume text`);
      }
      setParsedResume(data);
      if (data.repo_candidates && data.repo_candidates.length > 0) {
        const primary = data.repo_candidates[0];
        if (primary.owner) {
          setGithubUsername(primary.owner);
        }
      }
    } catch (err: any) {
      console.error('Failed to parse pasted resume:', err);
      setResumeError(err.message || 'Failed to parse resume text.');
    } finally {
      setIsParsingResume(false);
    }
  };

  // Handle file drop / upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResumeFile(file);
    processResumeFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') {
      setResumeFile(file);
      processResumeFile(file);
    }
  };

  // Fetch real repositories from GitHub API via backend
  const fetchUserRepos = async (username: string) => {
    if (!username.trim()) return;
    setIsLoadingRepos(true);
    setRepoFetchError(null);
    try {
      const candidates = await api.getUserRepos(username.trim());
      const items: RepoSelectorItem[] = candidates.map((c) => ({
        id: `repo_${c.owner}_${c.name}`,
        name: c.name,
        fullName: `${c.owner}/${c.name}`,
        owner: c.owner,
        url: c.url,
        description: c.description || 'Public repository',
        language: c.language || 'Unknown',
        fork: Boolean(c.fork),
        archived: Boolean(c.archived),
        pushed_at: c.pushed_at,
      }));
      setUserRepos(items);
      // Auto-select preferred non-fork repo if none currently selected
      if (selectedRepoFullNames.length === 0 && items.length > 0) {
        const preferred = items.find((r) => !r.fork) || items[0];
        setSelectedRepoFullNames([preferred.fullName]);
        setSelectedBranches({ [preferred.fullName]: 'main' });
        validateAndRecordScope(preferred.fullName, preferred.url);
      }
    } catch (err: any) {
      console.error('Failed to fetch user repos:', err);
      setRepoFetchError(err.message || `Failed to fetch public repositories for '${username}'.`);
    } finally {
      setIsLoadingRepos(false);
    }
  };

  // Automatically fetch repos when entering step 3 if username is known
  useEffect(() => {
    if (step === 3 && githubUsername.trim() && userRepos.length === 0) {
      fetchUserRepos(githubUsername.trim());
    }
  }, [step, githubUsername]);

  // Inspect repository scope (analyzable files, skipped reasons, HEAD SHA)
  const validateAndRecordScope = async (fullName: string, repoUrl: string) => {
    try {
      const result = await api.validateRepo(repoUrl);
      setRepoScopeReports((prev) => ({
        ...prev,
        [fullName]: {
          analyzed: result.scope?.analyzed || 0,
          skipped: result.scope?.skipped || 0,
          head_sha: result.head_sha,
          branch: result.default_branch || 'main',
        },
      }));
    } catch (err: any) {
      setRepoScopeReports((prev) => ({
        ...prev,
        [fullName]: {
          analyzed: 0,
          skipped: 0,
          head_sha: '',
          branch: 'main',
          error: err.message || 'Failed to inspect repository scope',
        },
      }));
    }
  };

  // Add arbitrary public repo URL entered by user
  const handleAddCustomRepo = async () => {
    if (!customRepoUrl.trim()) return;
    setIsConnectingCustom(true);
    setCustomRepoError(null);
    try {
      const res = await api.validateRepo(customRepoUrl.trim());
      const fullName = `${res.owner}/${res.name}`;
      const newItem: RepoSelectorItem = {
        id: `repo_${res.owner}_${res.name}`,
        name: res.name,
        fullName,
        owner: res.owner,
        url: customRepoUrl.trim(),
        description: 'Custom connected repository',
        language: res.is_python_backend ? 'Python' : 'Code',
        fork: false,
        archived: false,
      };
      setUserRepos((prev) => [newItem, ...prev.filter((r) => r.fullName !== fullName)]);
      if (!selectedRepoFullNames.includes(fullName) && selectedRepoFullNames.length < 3) {
        setSelectedRepoFullNames((prev) => [...prev, fullName]);
        setSelectedBranches((prev) => ({ ...prev, [fullName]: res.default_branch || 'main' }));
      }
      setRepoScopeReports((prev) => ({
        ...prev,
        [fullName]: {
          analyzed: res.scope?.analyzed || 0,
          skipped: res.scope?.skipped || 0,
          head_sha: res.head_sha,
          branch: res.default_branch || 'main',
        },
      }));
      setCustomRepoUrl('');
    } catch (err: any) {
      setCustomRepoError(err.message || 'Failed to connect repository. Please verify URL is public and valid.');
    } finally {
      setIsConnectingCustom(false);
    }
  };

  // Handle repo selection with max 3 rule and trigger scope report
  const handleToggleRepo = (fullName: string) => {
    if (selectedRepoFullNames.includes(fullName)) {
      if (selectedRepoFullNames.length > 1) {
        setSelectedRepoFullNames((prev) => prev.filter((r) => r !== fullName));
      }
    } else {
      if (selectedRepoFullNames.length < 3) {
        setSelectedRepoFullNames((prev) => [...prev, fullName]);
        if (!selectedBranches[fullName]) {
          setSelectedBranches((prev) => ({ ...prev, [fullName]: 'main' }));
        }
        const found = userRepos.find((r) => r.fullName === fullName);
        if (found) {
          validateAndRecordScope(fullName, found.url);
        }
      }
    }
  };

  const handleCompleteWizard = () => {
    const primaryRepo = selectedRepoFullNames[0] || (userRepos[0]?.fullName ?? '');
    const primaryUrl = primaryRepo.startsWith('http') ? primaryRepo : `https://github.com/${primaryRepo}`;

    const finalDraft: JobDraft = {
      id: `job_${Date.now()}`,
      title: jobTitle,
      company: jobCompany,
      source_url: jobUrl,
      source_type: sourceType,
      raw_text: jobText,
      requirements,
      dropped: droppedRequirements,
      extraction_mode: extractionMode || 'llm',
      confirmed: true,
    };
    onComplete(finalDraft, primaryUrl);
  };

  return (
    <div
      style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: '36px 20px',
      }}
    >
      {/* Wizard Step Indicator */}
      <StepperHeader
        steps={WIZARD_STEPS}
        currentStep={step}
        onStepClick={(id) => {
          // Allow going backwards to completed steps
          if (id < step) setStep(id as 1 | 2 | 3 | 4);
        }}
      />

      {/* ================= STEP 1: JOB SETUP & REQUIREMENTS ================= */}
      {step === 1 && (
        <div
          style={{
            backgroundColor: 'var(--surface-1, #0A1224)',
            border: '1px solid var(--border, #1A2748)',
            borderRadius: '12px',
            padding: '28px',
          }}
        >
          <div style={{ marginBottom: '22px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px', color: 'var(--text, #E8EEF9)' }}>
              Step 1: Target Job Specification
            </h2>
            <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--muted, #8C9AB8)' }}>
              Enter a job posting URL or paste the job description to extract technical requirements.
            </p>
          </div>

          {/* Job Title and Company (Confirmed or user-edited) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text, #E8EEF9)', marginBottom: '6px' }}>
                Job Title
              </label>
              <input
                type="text"
                data-testid="job-title-input"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Backend Software Engineer"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  backgroundColor: 'var(--surface-2, #101A30)',
                  border: '1px solid var(--border, #1A2748)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: 'var(--text, #E8EEF9)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text, #E8EEF9)', marginBottom: '6px' }}>
                Company Name
              </label>
              <input
                type="text"
                data-testid="job-company-input"
                value={jobCompany}
                onChange={(e) => setJobCompany(e.target.value)}
                placeholder="e.g. Acme Health"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  backgroundColor: 'var(--surface-2, #101A30)',
                  border: '1px solid var(--border, #1A2748)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: 'var(--text, #E8EEF9)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Job URL Input */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text, #E8EEF9)' }}>
                Job Posting URL (Greenhouse, Lever, or Company Career Page)
              </label>
              <SourceBadge sourceType={sourceType} />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'var(--surface-2, #101A30)',
                  border: '1px solid var(--border, #1A2748)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  gap: '8px',
                }}
              >
                <Globe size={16} color="var(--muted, #8C9AB8)" />
                <input
                  data-testid="job-url-input"
                  type="url"
                  value={jobUrl}
                  onChange={(e) => setJobUrl(e.target.value)}
                  placeholder="https://boards-api.greenhouse.io/v1/boards/company/jobs/12345"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text, #E8EEF9)',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              <button
                data-testid="fetch-preview-btn"
                type="button"
                onClick={handleFetchRequirements}
                disabled={isExtracting}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--surface-2, #101A30)',
                  border: '1px solid var(--border, #1A2748)',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  color: 'var(--text, #E8EEF9)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isExtracting ? 'not-allowed' : 'pointer',
                }}
              >
                {isExtracting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Fetching...</span>
                  </>
                ) : (
                  <span>Fetch Preview</span>
                )}
              </button>
            </div>
          </div>

          {extractionError && (
            <div style={{ marginBottom: '16px' }}>
              <InfoBanner message={extractionError} />
            </div>
          )}

          {/* Paste Description Fallback */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text, #E8EEF9)', marginBottom: '6px' }}>
              Or Paste Full Job Description Text
            </label>
            <textarea
              data-testid="job-text-input"
              value={jobText}
              onChange={(e) => {
                setJobText(e.target.value);
                setSourceType('user_provided');
              }}
              rows={4}
              placeholder="Paste job posting text here..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                backgroundColor: 'var(--surface-2, #101A30)',
                border: '1px solid var(--border, #1A2748)',
                borderRadius: '8px',
                padding: '10px 14px',
                color: 'var(--text, #E8EEF9)',
                fontSize: '13px',
                lineHeight: 1.5,
                outline: 'none',
                resize: 'vertical',
              }}
            />
            <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                data-testid="extract-text-btn"
                type="button"
                onClick={handleExtractPastedText}
                disabled={isExtracting || !jobText.trim()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--surface-2, #101A30)',
                  border: '1px solid var(--border, #1A2748)',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  color: 'var(--text, #E8EEF9)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: isExtracting ? 'not-allowed' : 'pointer',
                }}
              >
                {isExtracting ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                <span>Extract Requirements from Text</span>
              </button>
            </div>
          </div>

          {/* Extracted Requirements Review List */}
          <div style={{ paddingTop: '20px', borderTop: '1px solid var(--border, #1A2748)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--text, #E8EEF9)' }}>
                    Technical Requirements ({requirements.length})
                  </h3>
                  {extractionMode === 'Deterministic only' && (
                    <span
                      data-testid="deterministic-only-chip"
                      style={{
                        backgroundColor: 'rgba(234, 179, 8, 0.15)',
                        color: '#FACC15',
                        border: '1px solid rgba(234, 179, 8, 0.3)',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}
                    >
                      Deterministic only
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '12px', color: 'var(--muted, #8C9AB8)' }}>
                  Review and customize the extracted skills before verification
                </span>
              </div>

              <button
                type="button"
                onClick={handleAddRequirement}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: 'none',
                  border: '1px solid var(--border, #1A2748)',
                  borderRadius: '6px',
                  color: 'var(--primary, #2F6DF6)',
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Plus size={13} />
                <span>Add Skill</span>
              </button>
            </div>

            {/* Dropped Requirements Warning Card */}
            {droppedRequirements.length > 0 && (
              <div
                data-testid="dropped-requirements-card"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: '#F87171', fontSize: '12.5px', fontWeight: 600 }}>
                  <AlertTriangle size={14} />
                  <span>Dropped Requirements ({droppedRequirements.length} items failed validation):</span>
                </div>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--muted, #8C9AB8)' }}>
                  {droppedRequirements.map((d, i) => (
                    <li key={i} style={{ marginBottom: '4px' }}>
                      <strong style={{ color: 'var(--text, #E8EEF9)' }}>{d.skill_key}:</strong>{' '}
                      <em>"{d.quote.slice(0, 80)}"</em> — <span style={{ color: '#F87171' }}>{d.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              {requirements.length === 0 ? (
                <div
                  data-testid="no-requirements-state"
                  style={{
                    padding: '32px 20px',
                    textAlign: 'center',
                    backgroundColor: 'var(--surface-2, #101A30)',
                    borderRadius: '8px',
                    color: 'var(--muted, #8C9AB8)',
                    fontSize: '13px',
                  }}
                >
                  No technical requirements extracted yet. Enter a job posting URL above and click <strong>Fetch Preview</strong>, or paste the job description text.
                </div>
              ) : (
                requirements.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      backgroundColor: 'var(--surface-2, #101A30)',
                      border: '1px solid var(--border, #1A2748)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                    }}
                  >
                    <SkillIconTile skill={req.name} size="sm" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="text"
                          value={req.name}
                          onChange={(e) => handleUpdateRequirement(req.id, { name: e.target.value })}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text, #E8EEF9)',
                            fontSize: '13px',
                            fontWeight: 600,
                            outline: 'none',
                            width: '200px',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateRequirement(req.id, {
                              priority: req.priority === 'must' ? 'nice' : 'must',
                            })
                          }
                          style={{
                            backgroundColor:
                              req.priority === 'must'
                                ? 'rgba(47, 109, 246, 0.15)'
                                : 'rgba(148, 163, 184, 0.15)',
                            color: req.priority === 'must' ? '#60A5FA' : '#94A3B8',
                            border: '1px solid rgba(47, 109, 246, 0.25)',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            cursor: 'pointer',
                          }}
                        >
                          {req.priority.toUpperCase()}
                        </button>
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--muted, #8C9AB8)',
                          marginTop: '3px',
                          fontStyle: 'italic',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        &quot;{req.source_sentence}&quot;
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteRequirement(req.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--muted, #8C9AB8)',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Step 1 Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={onCancel}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted, #8C9AB8)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                data-testid="next-to-resume-btn"
                disabled={requirements.length === 0}
                onClick={() => setStep(2)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'var(--primary, #2F6DF6)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: requirements.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: requirements.length === 0 ? 0.5 : 1,
                }}
              >
                <span>Next: Upload Resume</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= STEP 2: RESUME UPLOAD & CLAIMS ================= */}
      {step === 2 && (
        <div
          style={{
            backgroundColor: 'var(--surface-1, #0A1224)',
            border: '1px solid var(--border, #1A2748)',
            borderRadius: '12px',
            padding: '28px',
          }}
        >
          <div style={{ marginBottom: '22px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px', color: 'var(--text, #E8EEF9)' }}>
              Step 2: Candidate Resume (E0 Claims)
            </h2>
            <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--muted, #8C9AB8)' }}>
              Upload your PDF resume to extract claimed skills and discover linked GitHub repositories.
            </p>
          </div>

          {/* Toggle upload vs paste */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
            <button
              type="button"
              onClick={() => setResumeMode('upload')}
              style={{
                backgroundColor: resumeMode === 'upload' ? 'var(--primary, #2F6DF6)' : 'var(--surface-2, #101A30)',
                color: resumeMode === 'upload' ? '#FFFFFF' : 'var(--muted, #8C9AB8)',
                border: '1px solid var(--border, #1A2748)',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              PDF Upload
            </button>
            <button
              type="button"
              onClick={() => setResumeMode('paste')}
              style={{
                backgroundColor: resumeMode === 'paste' ? 'var(--primary, #2F6DF6)' : 'var(--surface-2, #101A30)',
                color: resumeMode === 'paste' ? '#FFFFFF' : 'var(--muted, #8C9AB8)',
                border: '1px solid var(--border, #1A2748)',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Paste Resume Text
            </button>
          </div>

          {/* Drag & Drop Area */}
          {resumeMode === 'upload' ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              style={{
                border: '2px dashed var(--border, #1A2748)',
                borderRadius: '10px',
                backgroundColor: 'var(--surface-2, #101A30)',
                padding: '36px 20px',
                textAlign: 'center',
                marginBottom: '20px',
                cursor: 'pointer',
              }}
            >
              <Upload size={32} color="var(--primary, #2F6DF6)" style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text, #E8EEF9)', marginBottom: '4px' }}>
                {resumeFile ? resumeFile.name : 'Drag & drop resume PDF here'}
              </div>
              {isParsingResume ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#60A5FA', fontSize: '13px', margin: '8px 0' }}>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Parsing resume text & hyperlink metadata...</span>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--muted, #8C9AB8)', marginBottom: '14px' }}>
                  Supports standard selectable PDF documents up to 5MB
                </div>
              )}
              <label
                style={{
                  display: 'inline-block',
                  backgroundColor: 'rgba(47, 109, 246, 0.15)',
                  color: '#60A5FA',
                  border: '1px solid rgba(47, 109, 246, 0.3)',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Browse Files
                <input
                  type="file"
                  accept="application/pdf"
                  data-testid="resume-file-input"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          ) : (
            <div style={{ marginBottom: '20px' }}>
              <textarea
                data-testid="resume-paste-textarea"
                value={resumePasteText}
                onChange={(e) => setResumePasteText(e.target.value)}
                placeholder="Paste the full text of your resume here..."
                rows={6}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  backgroundColor: 'var(--surface-2, #101A30)',
                  border: '1px solid var(--border, #1A2748)',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  color: 'var(--text, #E8EEF9)',
                  fontSize: '13px',
                  lineHeight: 1.5,
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
              <button
                type="button"
                data-testid="extract-resume-text-btn"
                onClick={processResumeText}
                disabled={isParsingResume || !resumePasteText.trim()}
                style={{
                  marginTop: '10px',
                  backgroundColor: 'var(--primary, #2F6DF6)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '7px 14px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: isParsingResume || !resumePasteText.trim() ? 'not-allowed' : 'pointer',
                  opacity: isParsingResume || !resumePasteText.trim() ? 0.6 : 1,
                }}
              >
                Extract Skills from Pasted Text
              </button>
            </div>
          )}

          {/* Resume Upload Error Banner */}
          {resumeError && (
            <div
              data-testid="resume-error-banner"
              style={{
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '8px',
                padding: '12px 16px',
                color: '#F87171',
                fontSize: '13px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} />
                <span>{resumeError}</span>
              </div>
              <button
                type="button"
                onClick={() => setResumeError(null)}
                style={{
                  background: 'none',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  color: '#F87171',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Resume Upload Success Banner */}
          {resumeSuccessMessage && !resumeError && (
            <div
              data-testid="resume-success-banner"
              style={{
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                borderRadius: '8px',
                padding: '10px 16px',
                color: '#34D399',
                fontSize: '13px',
              }}
            >
              <CheckCircle2 size={16} />
              <span>{resumeSuccessMessage}</span>
            </div>
          )}

          {/* Scanned PDF Warning per IN-3 specs */}
          {isScannedPdfWarning && (
            <div style={{ marginBottom: '18px' }} data-testid="scanned-pdf-warning">
              <div
                style={{
                  backgroundColor: 'rgba(251, 191, 36, 0.1)',
                  border: '1px solid rgba(251, 191, 36, 0.3)',
                  borderRadius: '8px',
                  padding: '14px 16px',
                  color: '#FBBF24',
                  fontSize: '13px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={18} />
                    <span>
                      No selectable text found in this PDF (likely scanned or image-only). Please switch to paste text or enter your GitHub handle below.
                    </span>
                  </div>
                  <button
                    type="button"
                    data-testid="scanned-switch-to-paste-btn"
                    onClick={() => setResumeMode('paste')}
                    style={{
                      backgroundColor: 'rgba(251, 191, 36, 0.2)',
                      border: '1px solid rgba(251, 191, 36, 0.5)',
                      borderRadius: '6px',
                      padding: '5px 12px',
                      color: '#FBBF24',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Paste Text Option
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--muted, #8C9AB8)' }}>Manual GitHub entry:</span>
                  <input
                    type="text"
                    data-testid="manual-github-username-input"
                    value={githubUsername}
                    onChange={(e) => setGithubUsername(e.target.value.trim())}
                    placeholder="e.g. sranjit29794-bit"
                    style={{
                      backgroundColor: 'var(--surface-1, #0B1120)',
                      border: '1px solid rgba(251, 191, 36, 0.4)',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      color: '#E8EEF9',
                      fontSize: '12px',
                      width: '200px',
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Parsed Resume Claims Preview */}
          <div
            style={{
              backgroundColor: 'var(--surface-2, #101A30)',
              border: '1px solid var(--border, #1A2748)',
              borderRadius: '10px',
              padding: '18px',
              marginBottom: '26px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text, #E8EEF9)' }}>
                Extracted Resume Claims ({parsedResume.claimed_skills.length} skills)
              </div>
              <span style={{ fontSize: '12px', color: 'var(--muted, #8C9AB8)' }}>
                Source: {parsedResume.filename} ({parsedResume.text_chars} chars)
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {parsedResume.claimed_skills.map((item, idx) => (
                <span
                  key={idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '12px',
                    color: '#60A5FA',
                  }}
                >
                  <FileText size={12} />
                  <span>{item.skill}</span>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      backgroundColor: 'rgba(59, 130, 246, 0.25)',
                      color: '#93C5FD',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                    }}
                  >
                    E0 Claim
                  </span>
                  {item.source_line && (
                    <span style={{ opacity: 0.6, fontSize: '11px' }}>(L{item.source_line})</span>
                  )}
                </span>
              ))}
            </div>

            {/* Extracted GitHub Links */}
            <div style={{ fontSize: '12px', color: 'var(--muted, #8C9AB8)' }} data-testid="extracted-github-links">
              <strong>Extracted GitHub Links: </strong>
              {parsedResume.repo_candidates.length === 0 ? (
                <span style={{ color: 'var(--muted, #8C9AB8)', marginLeft: '6px' }} data-testid="no-github-links">
                  None detected
                </span>
              ) : (
                parsedResume.repo_candidates.map((cand, idx) => (
                  <span
                    key={idx}
                    data-testid={`extracted-repo-${idx}`}
                    style={{ color: 'var(--text, #E8EEF9)', marginLeft: '6px' }}
                  >
                    {cand.url} ({cand.source})
                    {idx < parsedResume.repo_candidates.length - 1 ? ',' : ''}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Step 2 Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'none',
                border: 'none',
                color: 'var(--muted, #8C9AB8)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={() => setStep(3)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--primary, #2F6DF6)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <span>Next: Select Repositories</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 3: REPOSITORIES (1-3 SELECTION) ================= */}
      {step === 3 && (
        <div
          style={{
            backgroundColor: 'var(--surface-1, #0A1224)',
            border: '1px solid var(--border, #1A2748)',
            borderRadius: '12px',
            padding: '28px',
          }}
        >
          <div style={{ marginBottom: '22px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px', color: 'var(--text, #E8EEF9)' }}>
              Step 3: Select Candidate Repositories
            </h2>
            <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--muted, #8C9AB8)' }}>
              Select 1 to 3 public GitHub repositories demonstrating your code implementations.
            </p>
          </div>

          {/* "Not mine?" Warning Banner if owner differs from resume username */}
          {parsedResume.repo_candidates?.[0]?.owner &&
            githubUsername &&
            !githubUsername.toLowerCase().includes(parsedResume.repo_candidates[0].owner.toLowerCase()) && (
              <div
                data-testid="owner-mismatch-warning"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: 'rgba(251, 191, 36, 0.12)',
                  border: '1px solid rgba(251, 191, 36, 0.35)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  color: '#FBBF24',
                  fontSize: '12.5px',
                }}
              >
                <AlertTriangle size={16} />
                <span>
                  <strong>Not mine?</strong> The current GitHub username (<code>{githubUsername}</code>) differs from the username extracted from your resume (<code>{parsedResume.repo_candidates[0].owner}</code>).
                </span>
              </div>
            )}

          {/* GitHub Username Filter & Custom URL Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text, #E8EEF9)', marginBottom: '6px' }}>
                GitHub Username
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flex: 1,
                    backgroundColor: 'var(--surface-2, #101A30)',
                    border: '1px solid var(--border, #1A2748)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    gap: '8px',
                  }}
                >
                  <GitBranch size={16} color="var(--muted, #8C9AB8)" />
                  <input
                    type="text"
                    data-testid="github-username-input"
                    value={githubUsername}
                    onChange={(e) => setGithubUsername(e.target.value.trim())}
                    placeholder="e.g. sranjit29794-bit"
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text, #E8EEF9)',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>
                <button
                  type="button"
                  data-testid="fetch-repos-btn"
                  onClick={() => fetchUserRepos(githubUsername)}
                  disabled={isLoadingRepos || !githubUsername.trim()}
                  style={{
                    backgroundColor: 'var(--primary, #2F6DF6)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: isLoadingRepos || !githubUsername.trim() ? 'not-allowed' : 'pointer',
                    opacity: isLoadingRepos || !githubUsername.trim() ? 0.6 : 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isLoadingRepos ? <Loader2 size={14} className="animate-spin" /> : 'Fetch Repos'}
                </button>
              </div>
            </div>

            {/* Paste any public repository URL */}
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text, #E8EEF9)', marginBottom: '6px' }}>
                Or Paste Public Repo URL
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  data-testid="custom-repo-url-input"
                  value={customRepoUrl}
                  onChange={(e) => setCustomRepoUrl(e.target.value.trim())}
                  placeholder="https://github.com/owner/repo"
                  style={{
                    flex: 1,
                    backgroundColor: 'var(--surface-2, #101A30)',
                    border: '1px solid var(--border, #1A2748)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'var(--text, #E8EEF9)',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  data-testid="connect-custom-repo-btn"
                  onClick={handleAddCustomRepo}
                  disabled={isConnectingCustom || !customRepoUrl.trim()}
                  style={{
                    backgroundColor: 'var(--surface-2, #101A30)',
                    border: '1px solid var(--border, #1A2748)',
                    color: '#60A5FA',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: isConnectingCustom || !customRepoUrl.trim() ? 'not-allowed' : 'pointer',
                    opacity: isConnectingCustom || !customRepoUrl.trim() ? 0.6 : 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isConnectingCustom ? <Loader2 size={14} className="animate-spin" /> : 'Connect'}
                </button>
              </div>
            </div>
          </div>

          {/* Custom Repo Error Banner */}
          {customRepoError && (
            <div
              data-testid="custom-repo-error-banner"
              style={{
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#F87171',
                fontSize: '12.5px',
              }}
            >
              <span>{customRepoError}</span>
              <button
                type="button"
                onClick={() => setCustomRepoError(null)}
                style={{ background: 'none', border: 'none', color: '#F87171', cursor: 'pointer', fontSize: '11px' }}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Repo Fetch Error Banner */}
          {repoFetchError && (
            <div
              data-testid="repo-fetch-error-banner"
              style={{
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#F87171',
                fontSize: '12.5px',
              }}
            >
              <span>{repoFetchError}</span>
              <button
                type="button"
                onClick={() => fetchUserRepos(githubUsername)}
                style={{ background: 'none', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '4px', padding: '3px 8px', color: '#F87171', cursor: 'pointer', fontSize: '11px' }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Search Filter & Selection Counter */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--surface-2, #101A30)',
                border: '1px solid var(--border, #1A2748)',
                borderRadius: '6px',
                padding: '6px 10px',
                maxWidth: '320px',
                flex: 1,
              }}
            >
              <Search size={14} color="var(--muted, #8C9AB8)" />
              <input
                type="text"
                data-testid="repo-search-input"
                value={repoSearchQuery}
                onChange={(e) => setRepoSearchQuery(e.target.value)}
                placeholder="Filter repositories..."
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text, #E8EEF9)',
                  fontSize: '12.5px',
                  outline: 'none',
                  width: '100%',
                }}
              />
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text, #E8EEF9)' }}>
                Selected Repositories ({selectedRepoFullNames.length}/3)
              </span>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted, #8C9AB8)' }}>
                1 to 3 repositories supported per track
              </span>
            </div>
          </div>

          {/* Repositories List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
            {isLoadingRepos ? (
              <div style={{ padding: '36px', textAlign: 'center', color: 'var(--muted, #8C9AB8)', fontSize: '13px' }}>
                <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 10px', color: '#60A5FA' }} />
                <span>Loading repositories from GitHub...</span>
              </div>
            ) : userRepos.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--muted, #8C9AB8)', fontSize: '13px', backgroundColor: 'var(--surface-2, #101A30)', borderRadius: '8px' }}>
                No public repositories found. Enter a GitHub username above or paste a public repo URL.
              </div>
            ) : (
              userRepos
                .filter((repo) => {
                  if (!repoSearchQuery.trim()) return true;
                  const q = repoSearchQuery.toLowerCase();
                  return (
                    repo.fullName.toLowerCase().includes(q) ||
                    repo.description.toLowerCase().includes(q) ||
                    repo.language.toLowerCase().includes(q)
                  );
                })
                .map((repo) => {
                  const isSelected = selectedRepoFullNames.includes(repo.fullName);
                  const isDisabled = !isSelected && selectedRepoFullNames.length >= 3;
                  const scopeReport = repoScopeReports[repo.fullName];

                  return (
                    <div
                      key={repo.id}
                      onClick={() => !isDisabled && handleToggleRepo(repo.fullName)}
                      data-testid={`repo-item-${repo.name}`}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        backgroundColor: isSelected ? 'rgba(47, 109, 246, 0.08)' : 'var(--surface-2, #101A30)',
                        border: `1px solid ${isSelected ? 'var(--primary, #2F6DF6)' : 'var(--border, #1A2748)'}`,
                        borderRadius: '8px',
                        padding: '12px 16px',
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        opacity: isDisabled ? 0.5 : 1,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={() => handleToggleRepo(repo.fullName)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text, #E8EEF9)' }}>
                              {repo.fullName}
                            </span>
                            {/* Language Badge */}
                            {repo.language && repo.language !== 'Unknown' && (
                              <span
                                style={{
                                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                                  border: '1px solid rgba(59, 130, 246, 0.3)',
                                  borderRadius: '4px',
                                  padding: '1px 6px',
                                  fontSize: '11px',
                                  color: '#93C5FD',
                                }}
                              >
                                {repo.language}
                              </span>
                            )}
                            {/* Fork Badge */}
                            {repo.fork && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  backgroundColor: 'rgba(156, 163, 175, 0.15)',
                                  border: '1px solid rgba(156, 163, 175, 0.3)',
                                  borderRadius: '4px',
                                  padding: '1px 6px',
                                  fontSize: '10.5px',
                                  color: '#9CA3AF',
                                }}
                              >
                                <GitFork size={10} />
                                Fork
                              </span>
                            )}
                            {/* Archived Badge */}
                            {repo.archived && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  borderRadius: '4px',
                                  padding: '1px 6px',
                                  fontSize: '10.5px',
                                  color: '#F87171',
                                }}
                              >
                                <Archive size={10} />
                                Archived
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--muted, #8C9AB8)', marginTop: '2px' }}>
                            {repo.description}
                          </div>
                        </div>

                        {/* Branch selector if selected */}
                        {isSelected && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <GitBranch size={13} color="var(--muted, #8C9AB8)" />
                            <select
                              value={selectedBranches[repo.fullName] || 'main'}
                              onChange={(e) => {
                                e.stopPropagation();
                                setSelectedBranches({
                                  ...selectedBranches,
                                  [repo.fullName]: e.target.value,
                                });
                              }}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                backgroundColor: 'var(--surface-1, #0A1224)',
                                border: '1px solid var(--border, #1A2748)',
                                borderRadius: '6px',
                                color: 'var(--text, #E8EEF9)',
                                fontSize: '12px',
                                padding: '3px 8px',
                                outline: 'none',
                              }}
                            >
                              <option value="main">main</option>
                              <option value="master">master</option>
                              <option value="dev">dev</option>
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Scope Report Banner on Selection per IN-1 / BRAIN §13 */}
                      {isSelected && scopeReport && (
                        <div
                          data-testid={`scope-report-${repo.name}`}
                          style={{
                            marginTop: '4px',
                            padding: '6px 12px',
                            backgroundColor: scopeReport.error ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.08)',
                            border: `1px solid ${scopeReport.error ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.25)'}`,
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            color: scopeReport.error ? '#F87171' : '#34D399',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          {scopeReport.error ? (
                            <span>Scope error: {scopeReport.error}</span>
                          ) : (
                            <>
                              <span>
                                <strong>Scope Report:</strong> {scopeReport.analyzed} analyzable files found, {scopeReport.skipped} skipped
                              </span>
                              {scopeReport.head_sha && (
                                <span style={{ opacity: 0.8, fontFamily: 'monospace' }}>
                                  SHA: {scopeReport.head_sha.slice(0, 8)}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
            )}
          </div>

          {/* Step 3 Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setStep(2)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'none',
                border: 'none',
                color: 'var(--muted, #8C9AB8)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>

            <button
              type="button"
              disabled={selectedRepoFullNames.length === 0}
              onClick={() => setStep(4)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--primary, #2F6DF6)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <span>Next: Run Analysis</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 4: ANALYSIS (4 STAGES) ================= */}
      {step === 4 && (
        <div
          style={{
            backgroundColor: 'var(--surface-1, #0A1224)',
            border: '1px solid var(--border, #1A2748)',
            borderRadius: '12px',
            padding: '32px 28px',
          }}
        >
          <div style={{ marginBottom: '24px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px', color: 'var(--text, #E8EEF9)' }}>
              Step 4: Automated Verification Pipeline
            </h2>
            <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--muted, #8C9AB8)' }}>
              Evaluating repository commits against extracted requirements with deterministic AST detectors.
            </p>
          </div>

          {/* 4-Stage Progress Bar Card */}
          <div
            style={{
              backgroundColor: 'var(--surface-2, #101A30)',
              border: '1px solid var(--border, #1A2748)',
              borderRadius: '10px',
              padding: '24px',
              marginBottom: '28px',
            }}
          >
            {/* Progress Track */}
            <div
              style={{
                height: '8px',
                backgroundColor: 'var(--surface-1, #0A1224)',
                borderRadius: '4px',
                overflow: 'hidden',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${(analysisStage / 4) * 100}%`,
                  backgroundColor: 'var(--primary, #2F6DF6)',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>

            {/* Stage Indicators */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {[
                { stage: 1, title: '1. Fetching', desc: 'Resolving HEAD & blobs' },
                { stage: 2, title: '2. Scanning', desc: 'Running AST detectors' },
                { stage: 3, title: '3. Judging', desc: 'Validating citations' },
                { stage: 4, title: '4. Complete', desc: 'Ready to inspect' },
              ].map((s) => {
                const isPassed = analysisStage >= s.stage;
                const isCurrent = analysisStage === s.stage;

                return (
                  <div
                    key={s.stage}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      backgroundColor: isPassed
                        ? 'rgba(47, 109, 246, 0.1)'
                        : 'var(--surface-1, #0A1224)',
                      border: `1px solid ${
                        isCurrent
                          ? 'var(--primary, #2F6DF6)'
                          : isPassed
                          ? 'rgba(47, 109, 246, 0.3)'
                          : 'var(--border, #1A2748)'
                      }`,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: isPassed ? '#60A5FA' : 'var(--muted, #8C9AB8)',
                        marginBottom: '4px',
                      }}
                    >
                      {isPassed ? <CheckCircle2 size={14} /> : <Loader2 size={14} className="animate-spin" />}
                      <span>{s.title}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted, #8C9AB8)' }}>
                      {s.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Post-Completion Options */}
          {isFinished ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                {onViewClaimsMatrix && (
                  <button
                    type="button"
                    onClick={() => onViewClaimsMatrix('job_devproof_demo')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: 'var(--surface-2, #101A30)',
                      border: '1px solid var(--border, #1A2748)',
                      borderRadius: '8px',
                      padding: '12px 20px',
                      color: 'var(--text, #E8EEF9)',
                      fontSize: '13.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Table size={15} color="#60A5FA" />
                    <span>View Claims Matrix</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCompleteWizard}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'var(--primary, #2F6DF6)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 12px rgba(47, 109, 246, 0.4)',
                  }}
                >
                  <span>View Full Assessment Results</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--muted, #8C9AB8)' }}>
              <Loader2 size={16} className="animate-spin" style={{ display: 'inline', marginRight: '8px' }} />
              Executing deterministic verification rules...
            </div>
          )}
        </div>
      )}
    </div>
  );
};
