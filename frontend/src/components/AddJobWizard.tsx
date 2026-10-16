import React, { useState } from 'react';
import {
  Globe,
  FileText,
  Check,
  Copy,
  Plus,
  Trash2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  GitBranch,
  GitCommit,
  Radio,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import type { JobDraft, Requirement, RepoValidationResult, SourceType } from '../types';

interface AddJobWizardProps {
  onComplete: (job: JobDraft, repoUrl: string) => void;
  onCancel: () => void;
}

export const AddJobWizard: React.FC<AddJobWizardProps> = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // --- Step 1 State: Job Source ---
  const [sourceType, setSourceType] = useState<SourceType>('fetched');
  const [jobUrl, setJobUrl] = useState<string>('https://jobs.example.com/kinetik/backend-intern');
  const [jobText, setJobText] = useState<string>(
    'We are looking for a Backend Engineering Intern proficient in Python and FastAPI to build clean REST APIs. You will work with SQL databases, write unit and integration tests, and help containerize services for deployment.'
  );
  const [jobTitle, setJobTitle] = useState<string>('Backend Engineering Intern (Python/FastAPI)');
  const [jobCompany, setJobCompany] = useState<string>('Kinetik Health');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // --- Step 2 State: Editable Requirements ---
  const [requirements, setRequirements] = useState<Requirement[]>([
    {
      id: 'req_rest_api',
      name: 'REST APIs',
      category: 'Backend',
      priority: 'must',
      source_sentence: 'Proficient in Python and FastAPI to build clean REST APIs.',
      taxonomy_key: 'rest_api',
      search_terms: ['FastAPI', 'REST', 'router', 'endpoint', 'HTTP'],
      position: 1,
    },
    {
      id: 'req_sql_database',
      name: 'SQL Database',
      category: 'Database',
      priority: 'must',
      source_sentence: 'You will work with SQL databases.',
      taxonomy_key: 'sql_database',
      search_terms: ['SQL', 'sqlite', 'PostgreSQL', 'queries', 'database'],
      position: 2,
    },
    {
      id: 'req_testing',
      name: 'Testing',
      category: 'Quality Assurance',
      priority: 'must',
      source_sentence: 'Write unit and integration tests.',
      taxonomy_key: 'testing',
      search_terms: ['pytest', 'test', 'assert', 'mock', 'unittest'],
      position: 3,
    },
    {
      id: 'req_deployment',
      name: 'Deployment',
      category: 'DevOps',
      priority: 'nice',
      source_sentence: 'Help containerize services for deployment.',
      taxonomy_key: 'deployment',
      search_terms: ['Docker', 'Dockerfile', 'container', 'deploy', 'Kubernetes'],
      position: 4,
    },
    {
      id: 'req_python',
      name: 'Python',
      category: 'Language',
      priority: 'must',
      source_sentence: 'Proficient in Python.',
      taxonomy_key: 'python',
      search_terms: ['Python', 'typing', 'pydantic', 'asyncio'],
      position: 5,
    },
  ]);

  // --- Step 3 State: Repository Connection ---
  const [repoUrl, setRepoUrl] = useState<string>('https://github.com/rohan-student/student-api');
  const [isValidatingRepo, setIsValidatingRepo] = useState<boolean>(false);
  const [selectedScenario, setSelectedScenario] = useState<
    'normal' | 'private_repo' | 'non_python' | 'manual_webhook'
  >('normal');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // --- Actions & Helpers ---
  const handleExtractFromUrl = (simulatedFailure = false) => {
    setIsExtracting(true);
    setExtractionError(null);
    setTimeout(() => {
      setIsExtracting(false);
      if (simulatedFailure) {
        // BRAIN §17: Job URL blocked/403/JS-rendered -> Fall back to paste-text with User-provided badge
        setSourceType('user_provided');
        setExtractionError('Automatic fetch was blocked by anti-bot protection. Switched to manual paste mode. Your source URL is preserved.');
      } else {
        setSourceType('fetched');
        setStep(2);
      }
    }, 700);
  };

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
      source_sentence: 'User-specified skill requirement.',
      search_terms: [],
      position: requirements.length + 1,
    };
    setRequirements((prev) => [...prev, newReq]);
  };

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleFinalSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      const finalDraft: JobDraft = {
        title: jobTitle,
        company: jobCompany,
        source_url: jobUrl,
        source_type: sourceType,
        raw_text: jobText,
        requirements,
        confirmed: true,
      };
      onComplete(finalDraft, repoUrl);
    }, 800);
  };

  // Simulated repository validation responses per BRAIN §17
  const getRepoValidation = (): RepoValidationResult => {
    if (selectedScenario === 'private_repo') {
      return {
        valid: false,
        owner: 'rohan-student',
        name: 'private-repo',
        default_branch: 'main',
        head_sha: '',
        commit_message: '',
        analyzable_files: 0,
        scope: { analyzed: 0, skipped: 0, skipped_reasons: {}, truncated: false },
        is_python_backend: false,
        error: 'Repository not found or private. DevProof requires a public repository or a server-side GITHUB_TOKEN with repository read scope.',
        error_type: 'private_repo',
      };
    }
    if (selectedScenario === 'non_python') {
      return {
        valid: true,
        owner: 'rohan-student',
        name: 'react-frontend-portfolio',
        default_branch: 'main',
        head_sha: 'e9f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9',
        commit_message: 'chore: initial react portfolio template',
        analyzable_files: 0,
        scope: { analyzed: 0, skipped: 18, skipped_reasons: { javascript: 12, css: 4, json: 2 }, truncated: false },
        is_python_backend: false,
        error: 'MVP analyzes Python backends; analyzed 0 supported files. Status will be marked Unable to assess.',
        error_type: 'non_python',
      };
    }
    return {
      valid: true,
      owner: 'rohan-student',
      name: 'student-api',
      default_branch: 'main',
      head_sha: 'a1b2c3d4e5f67890123456789abcdef012345678',
      commit_message: 'Initial commit: FastAPI backend with in-memory store',
      analyzable_files: 4,
      scope: {
        analyzed: 4,
        skipped: 2,
        skipped_reasons: { docs: 1, virtualenv: 1 },
        truncated: false,
      },
      is_python_backend: true,
    };
  };

  const validation = getRepoValidation();

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto', padding: '32px 16px' }}>
      {/* Wizard Progress Stepper */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '32px',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '20px',
        }}
      >
        {[
          { num: 1, label: 'Job Source' },
          { num: 2, label: 'Review Requirements' },
          { num: 3, label: 'Connect Repository' },
        ].map((s, idx) => {
          const isActive = step === s.num;
          const isDone = step > s.num;
          return (
            <React.Fragment key={s.num}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: isDone
                      ? 'var(--status-demonstrated)'
                      : isActive
                      ? 'var(--accent)'
                      : 'var(--surface-2)',
                    color: isDone || isActive ? '#000' : 'var(--muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '13px',
                    boxShadow: isActive ? '0 0 10px rgba(45, 212, 191, 0.4)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {isDone ? <Check size={16} strokeWidth={3} /> : s.num}
                </div>
                <div>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? 'var(--text)' : 'var(--muted)',
                    }}
                  >
                    {s.label}
                  </span>
                </div>
              </div>
              {idx < 2 && (
                <div
                  style={{
                    flex: 1,
                    height: '1px',
                    backgroundColor: step > idx + 1 ? 'var(--status-demonstrated)' : 'var(--border)',
                    margin: '0 16px',
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* ==================================================================== */}
      {/* STEP 1: JOB SOURCE */}
      {/* ==================================================================== */}
      {step === 1 && (
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '28px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 6px 0' }}>
                Step 1: Provide Job Description
              </h2>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '13.5px' }}>
                Paste the URL of any public job or internship posting, or enter raw description text.
              </p>
            </div>

            {/* Source Type Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor:
                  sourceType === 'fetched'
                    ? 'rgba(45, 212, 191, 0.12)'
                    : 'rgba(251, 191, 36, 0.12)',
                color:
                  sourceType === 'fetched'
                    ? 'var(--accent)'
                    : 'var(--status-partial)',
                border: `1px solid ${
                  sourceType === 'fetched'
                    ? 'rgba(45, 212, 191, 0.3)'
                    : 'rgba(251, 191, 36, 0.3)'
                }`,
              }}
            >
              {sourceType === 'fetched' ? <Globe size={13} /> : <FileText size={13} />}
              <span>{sourceType === 'fetched' ? 'Source: Fetched' : 'Source: User-provided'}</span>
            </div>
          </div>

          {/* Mode Switch Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            <button
              onClick={() => {
                setSourceType('fetched');
                setExtractionError(null);
              }}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: '8px',
                backgroundColor: sourceType === 'fetched' ? 'var(--surface-2)' : 'transparent',
                border: `1px solid ${sourceType === 'fetched' ? 'var(--accent)' : 'var(--border)'}`,
                color: sourceType === 'fetched' ? 'var(--accent)' : 'var(--muted)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Globe size={16} /> Fetch from Public URL
            </button>
            <button
              onClick={() => {
                setSourceType('user_provided');
                setExtractionError(null);
              }}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: '8px',
                backgroundColor: sourceType === 'user_provided' ? 'var(--surface-2)' : 'transparent',
                border: `1px solid ${sourceType === 'user_provided' ? 'var(--accent)' : 'var(--border)'}`,
                color: sourceType === 'user_provided' ? 'var(--accent)' : 'var(--muted)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <FileText size={16} /> Can't fetch? Paste job text
            </button>
          </div>

          {/* Persistent Source URL Input (Always Visible per BRAIN §4 F1) */}
          <div style={{ marginBottom: '18px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12.5px',
                fontWeight: 600,
                color: 'var(--text)',
                marginBottom: '6px',
              }}
            >
              Job Source URL (Stored for evidence citations & verifiable provenance)
            </label>
            <input
              type="text"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              placeholder="https://company.com/careers/posting"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '6px',
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>

          {/* Error / Blocked Alert */}
          {extractionError && (
            <div
              style={{
                backgroundColor: 'rgba(251, 191, 36, 0.1)',
                border: '1px solid rgba(251, 191, 36, 0.3)',
                borderRadius: '6px',
                padding: '12px 16px',
                marginBottom: '18px',
                color: 'var(--status-partial)',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
              }}
            >
              <AlertTriangle size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <strong>Fallback Mode Active:</strong> {extractionError}
              </div>
            </div>
          )}

          {/* Conditional Input based on Tab */}
          {sourceType === 'user_provided' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                    Job Title
                  </label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                      fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={jobCompany}
                    onChange={(e) => setJobCompany(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                      fontSize: '13px',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                  Raw Job Description Text
                </label>
                <textarea
                  rows={5}
                  value={jobText}
                  onChange={(e) => setJobText(e.target.value)}
                  placeholder="Paste the job posting requirements and role description here..."
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    fontSize: '13px',
                    lineHeight: 1.5,
                    resize: 'vertical',
                    outline: 'none',
                  }}
                />
              </div>
            </>
          )}

          {/* Fixture Scenarios / Simulation Buttons per BRAIN §17 */}
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: 'var(--surface-2)',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              marginBottom: '24px',
              fontSize: '12px',
            }}
          >
            <div style={{ color: 'var(--muted)', marginBottom: '8px', fontWeight: 600 }}>
              Demo / Test Edge Case Shortcuts (§17):
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleExtractFromUrl(false)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Normal URL Fetch (Kinetik Health)
              </button>
              <button
                type="button"
                onClick={() => handleExtractFromUrl(true)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--status-partial)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Test Blocked/JS-rendered URL (403 Fallback)
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '9px 18px',
                borderRadius: '6px',
                backgroundColor: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--muted)',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => {
                if (sourceType === 'fetched') {
                  handleExtractFromUrl(false);
                } else {
                  setStep(2);
                }
              }}
              disabled={isExtracting}
              style={{
                padding: '9px 22px',
                borderRadius: '6px',
                backgroundColor: 'var(--accent)',
                color: '#000',
                border: 'none',
                fontWeight: 600,
                fontSize: '13px',
                cursor: isExtracting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {isExtracting ? (
                <>
                  <Sparkles size={14} className="animate-spin" />
                  <span>Extracting Skills...</span>
                </>
              ) : (
                <>
                  <span>Extract Requirements</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STEP 2: REVIEW & EDIT REQUIREMENTS */}
      {/* ==================================================================== */}
      {step === 2 && (
        <div>
          {/* Banner per BRAIN §4 F1: "AI extracted these — please confirm." */}
          <div
            style={{
              backgroundColor: 'rgba(45, 212, 191, 0.08)',
              border: '1px solid rgba(45, 212, 191, 0.25)',
              borderRadius: 'var(--radius)',
              padding: '12px 20px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sparkles size={18} style={{ color: 'var(--accent)' }} />
              <div>
                <span style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--accent)' }}>
                  AI extracted {requirements.length} requirements — please review and confirm.
                </span>
                <p style={{ margin: '2px 0 0 0', color: 'var(--muted)', fontSize: '12px' }}>
                  Edit skill titles, categories, priority, or quotes to align with your expectations.
                </p>
              </div>
            </div>
            <button
              onClick={handleAddRequirement}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Plus size={14} /> Add Requirement
            </button>
          </div>

          {/* Requirement Cards List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            {requirements.map((req, index) => (
              <div
                key={req.id}
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <span
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        color: 'var(--muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      {index + 1}
                    </span>

                    {/* Requirement Name Input */}
                    <input
                      type="text"
                      value={req.name}
                      onChange={(e) => handleUpdateRequirement(req.id, { name: e.target.value })}
                      style={{
                        fontSize: '15px',
                        fontWeight: 600,
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderBottom: '1px dashed var(--border)',
                        color: 'var(--text)',
                        padding: '2px 4px',
                        outline: 'none',
                        minWidth: '180px',
                      }}
                    />

                    {/* Category Input */}
                    <input
                      type="text"
                      value={req.category}
                      onChange={(e) => handleUpdateRequirement(req.id, { category: e.target.value })}
                      placeholder="Category"
                      style={{
                        fontSize: '12px',
                        backgroundColor: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        color: 'var(--muted)',
                        padding: '3px 8px',
                        outline: 'none',
                        width: '120px',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Priority Toggle: Must / Nice */}
                    <div
                      style={{
                        display: 'flex',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        overflow: 'hidden',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleUpdateRequirement(req.id, { priority: 'must' })}
                        style={{
                          padding: '4px 10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          backgroundColor:
                            req.priority === 'must' ? 'var(--accent)' : 'var(--surface-2)',
                          color: req.priority === 'must' ? '#000' : 'var(--muted)',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        Must
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateRequirement(req.id, { priority: 'nice' })}
                        style={{
                          padding: '4px 10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          backgroundColor:
                            req.priority === 'nice' ? 'var(--accent-2)' : 'var(--surface-2)',
                          color: req.priority === 'nice' ? '#000' : 'var(--muted)',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        Nice
                      </button>
                    </div>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteRequirement(req.id)}
                      title="Delete requirement"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--muted)',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px',
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Original Source Quote Input */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>
                    Original Source Sentence Quote:
                  </label>
                  <input
                    type="text"
                    value={req.source_sentence}
                    onChange={(e) => handleUpdateRequirement(req.id, { source_sentence: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                      fontSize: '12px',
                      fontStyle: 'italic',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Stepper Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '6px',
                backgroundColor: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--muted)',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              <ArrowLeft size={14} /> Back
            </button>

            <button
              type="button"
              onClick={() => setStep(3)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 22px',
                borderRadius: '6px',
                backgroundColor: 'var(--accent)',
                color: '#000',
                border: 'none',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <span>Confirm & Choose Repo</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STEP 3: CONNECT REPOSITORY & VALIDATION */}
      {/* ==================================================================== */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Repo Input Card */}
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '24px',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 6px 0' }}>
              Step 3: Connect Candidate Repository
            </h2>
            <p style={{ margin: '0 0 16px 0', color: 'var(--muted)', fontSize: '13px' }}>
              Enter the GitHub repository URL to evaluate against the confirmed requirements.
            </p>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/username/repository"
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontSize: '13px',
                }}
              />
              <button
                type="button"
                onClick={() => {
                  setIsValidatingRepo(true);
                  setTimeout(() => setIsValidatingRepo(false), 500);
                }}
                disabled={isValidatingRepo}
                style={{
                  padding: '10px 18px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {isValidatingRepo ? 'Validating...' : 'Re-check'}
              </button>
            </div>

            {/* Simulation Shortcut Buttons for Unexpected Scenarios (§17) */}
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--surface-2)',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                fontSize: '12px',
              }}
            >
              <div style={{ color: 'var(--muted)', marginBottom: '6px', fontWeight: 600 }}>
                Simulate Repo Edge Cases (§17):
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedScenario('normal');
                    setRepoUrl('https://github.com/rohan-student/student-api');
                  }}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: selectedScenario === 'normal' ? 'var(--accent)' : 'var(--surface)',
                    color: selectedScenario === 'normal' ? '#000' : 'var(--text)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                >
                  student-api (Valid Python)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedScenario('private_repo');
                    setRepoUrl('https://github.com/rohan-student/private-repo');
                  }}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: selectedScenario === 'private_repo' ? 'var(--accent)' : 'var(--surface)',
                    color: selectedScenario === 'private_repo' ? '#000' : 'var(--text)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                >
                  Private / Inaccessible Repo Error
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedScenario('non_python');
                    setRepoUrl('https://github.com/rohan-student/react-frontend-portfolio');
                  }}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: selectedScenario === 'non_python' ? 'var(--accent)' : 'var(--surface)',
                    color: selectedScenario === 'non_python' ? '#000' : 'var(--text)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                >
                  Non-Python Repo Warning
                </button>
              </div>
            </div>
          </div>

          {/* Validation Result Card */}
          {validation.error ? (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius)',
                padding: '18px 20px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
              }}
            >
              <AlertCircle size={18} style={{ color: '#EF4444', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px', color: '#EF4444', marginBottom: '4px' }}>
                  {validation.error_type === 'private_repo'
                    ? 'Repository Access Failed'
                    : 'Language Scope Warning'}
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text)', lineHeight: 1.5 }}>
                  {validation.error}
                </p>
              </div>
            </div>
          ) : (
            <div
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={16} style={{ color: 'var(--status-demonstrated)' }} />
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>Repository Validated</span>
                </div>
                <span
                  style={{
                    fontSize: '12px',
                    color: 'var(--muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <ExternalLink size={12} /> View on GitHub
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                  backgroundColor: 'var(--surface-2)',
                  padding: '14px',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                }}
              >
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', marginBottom: '2px' }}>
                    Default Branch:
                  </span>
                  <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <GitBranch size={13} /> {validation.default_branch}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', marginBottom: '2px' }}>
                    HEAD Commit SHA:
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <GitCommit size={13} /> {validation.head_sha.substring(0, 7)}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', marginBottom: '2px' }}>
                    Analyzable Scope:
                  </span>
                  <span style={{ fontWeight: 600 }}>
                    {validation.scope.analyzed} files ({validation.scope.skipped} skipped)
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', marginBottom: '2px' }}>
                    Last Commit:
                  </span>
                  <span style={{ color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {validation.commit_message}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Webhook Configuration Card */}
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Radio size={16} style={{ color: 'var(--accent)' }} />
                <span style={{ fontWeight: 600, fontSize: '14px' }}>Automatic Reassessment Webhook</span>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedScenario('normal')}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    backgroundColor: selectedScenario === 'normal' ? 'var(--accent)' : 'var(--surface-2)',
                    color: selectedScenario === 'normal' ? '#000' : 'var(--muted)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                >
                  Auto-registered (PAT)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedScenario('manual_webhook')}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    backgroundColor: selectedScenario === 'manual_webhook' ? 'var(--accent)' : 'var(--surface-2)',
                    color: selectedScenario === 'manual_webhook' ? '#000' : 'var(--muted)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                >
                  Manual Instructions Card
                </button>
              </div>
            </div>

            {selectedScenario !== 'manual_webhook' ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--status-demonstrated)',
                  fontSize: '13px',
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--status-demonstrated)',
                    boxShadow: '0 0 8px var(--status-demonstrated)',
                  }}
                />
                <span>Webhook automatically registered via server PAT. Pushes will trigger instant re-evaluation.</span>
              </div>
            ) : (
              <div style={{ fontSize: '13px' }}>
                <p style={{ margin: '0 0 12px 0', color: 'var(--muted)' }}>
                  Server token does not have admin permissions to create webhooks automatically. Copy these into your GitHub repository settings:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Webhook URL */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'var(--surface-2)',
                      padding: '8px 12px',
                      borderRadius: '6px',
                    }}
                  >
                    <div>
                      <span style={{ color: 'var(--muted)', fontSize: '11px', display: 'block' }}>Payload URL:</span>
                      <code>https://api.devproof.example.com/api/webhooks/github</code>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('https://api.devproof.example.com/api/webhooks/github', 'url')}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                      }}
                    >
                      {copiedField === 'url' ? <Check size={12} /> : <Copy size={12} />}
                      {copiedField === 'url' ? 'Copied' : 'Copy'}
                    </button>
                  </div>

                  {/* Secret */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'var(--surface-2)',
                      padding: '8px 12px',
                      borderRadius: '6px',
                    }}
                  >
                    <div>
                      <span style={{ color: 'var(--muted)', fontSize: '11px', display: 'block' }}>Secret:</span>
                      <code>devproof_whsec_991823a</code>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('devproof_whsec_991823a', 'secret')}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                      }}
                    >
                      {copiedField === 'secret' ? <Check size={12} /> : <Copy size={12} />}
                      {copiedField === 'secret' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Stepper Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setStep(2)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '6px',
                backgroundColor: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--muted)',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              <ArrowLeft size={14} /> Back to Requirements
            </button>

            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={isSubmitting || !validation.valid}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 24px',
                borderRadius: '6px',
                backgroundColor: !validation.valid ? 'var(--surface-2)' : 'var(--accent)',
                color: !validation.valid ? 'var(--muted)' : '#000',
                border: 'none',
                fontWeight: 700,
                fontSize: '14px',
                cursor: !validation.valid || isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: validation.valid ? '0 0 15px rgba(45, 212, 191, 0.3)' : 'none',
              }}
            >
              {isSubmitting ? (
                <>
                  <Sparkles size={16} className="animate-spin" />
                  <span>Launching Initial Assessment...</span>
                </>
              ) : (
                <>
                  <span>Run Assessment</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
