import React, { useState, useEffect } from 'react';
import {
  Globe,
  Check,
  Copy,
  Plus,
  Trash2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  GitBranch,
  Pin,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import type { JobDraft, Requirement, SourceType } from '../types';
import { StepperHeader } from './StepperHeader';
import { SourceBadge } from './SourceBadge';
import { SkillIconTile } from './SkillIconTile';
import { InfoBanner } from './InfoBanner';
import { ChecklistItem } from './ChecklistItem';

interface AddJobWizardProps {
  onComplete: (job: JobDraft, repoUrl: string) => void;
  onCancel: () => void;
}

export const AddJobWizard: React.FC<AddJobWizardProps> = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // --- Step 1 State: Job Source & Requirements ---
  const [sourceType, setSourceType] = useState<SourceType>('fetched');
  const [jobUrl, setJobUrl] = useState<string>('https://jobs.example.com/kinetik/backend-intern');
  const [jobText, setJobText] = useState<string>(
    'We are looking for a Backend Engineering Intern proficient in Python and FastAPI to build clean REST APIs. You will work with SQL databases, write unit and integration tests, and help containerize services for deployment with GitHub Actions CI/CD pipelines.'
  );
  const [jobTitle] = useState<string>('Backend Engineering Intern (Python/FastAPI)');
  const [jobCompany] = useState<string>('Kinetik Health');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // 6 Canonical Requirements matching BRAIN §19.1 demo
  const [requirements, setRequirements] = useState<Requirement[]>([
    {
      id: 'req_python',
      name: 'Python',
      category: 'Language',
      priority: 'must',
      source_sentence: 'Proficient in Python.',
      taxonomy_key: 'python',
      search_terms: ['Python', 'typing', 'pydantic', 'asyncio'],
      position: 1,
    },
    {
      id: 'req_rest_api',
      name: 'FastAPI / REST APIs',
      category: 'Backend',
      priority: 'must',
      source_sentence: 'Proficient in Python and FastAPI to build clean REST APIs.',
      taxonomy_key: 'rest_api',
      search_terms: ['FastAPI', 'REST', 'router', 'endpoint', 'HTTP'],
      position: 2,
    },
    {
      id: 'req_sql_database',
      name: 'SQL',
      category: 'Database',
      priority: 'must',
      source_sentence: 'You will work with SQL databases.',
      taxonomy_key: 'sql_database',
      search_terms: ['SQL', 'sqlite', 'PostgreSQL', 'queries', 'database'],
      position: 3,
    },
    {
      id: 'req_testing',
      name: 'Testing',
      category: 'Quality Assurance',
      priority: 'must',
      source_sentence: 'Write unit and integration tests.',
      taxonomy_key: 'testing',
      search_terms: ['pytest', 'test', 'assert', 'mock', 'unittest'],
      position: 4,
    },
    {
      id: 'req_deployment',
      name: 'Deployment',
      category: 'DevOps',
      priority: 'nice',
      source_sentence: 'Help containerize services for deployment.',
      taxonomy_key: 'deployment',
      search_terms: ['Docker', 'Dockerfile', 'container', 'deploy', 'Kubernetes'],
      position: 5,
    },
    {
      id: 'req_ci_cd',
      name: 'CI/CD (GitHub Actions)',
      category: 'DevOps',
      priority: 'nice',
      source_sentence: 'Automate testing and deployment pipelines with GitHub Actions.',
      taxonomy_key: 'ci_cd',
      search_terms: ['github-actions', 'workflow', 'ci', 'cd', 'pipeline'],
      position: 6,
    },
  ]);

  // --- Step 2 State: Repository Analysis ---
  const [repoUrl, setRepoUrl] = useState<string>('https://github.com/rohan-student/student-api');
  const [isEditingRepo, setIsEditingRepo] = useState<boolean>(false);
  const [commitSha] = useState<string>('c3d4e5f67890123456789abcdef0123456789012');
  const [isPinnedSha, setIsPinnedSha] = useState<boolean>(false);
  const [selectedScenario, setSelectedScenario] = useState<
    'normal' | 'private_repo' | 'non_python' | 'manual_webhook'
  >('normal');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // --- Step 3 State: Analysis Checklist Progress ---
  const [analysisStep, setAnalysisStep] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  // Handle URL fetch simulation or real trigger
  const handleFetchRequirements = (simulatedBlocked = false) => {
    setIsExtracting(true);
    setExtractionError(null);

    setTimeout(() => {
      setIsExtracting(false);
      if (simulatedBlocked || jobUrl.includes('blocked')) {
        // BRAIN §17: Blocked URL state switches to paste tab with User-provided badge
        setSourceType('user_provided');
        setExtractionError(
          'Automatic fetch was blocked by anti-bot protection. Switched to manual paste mode. Your source URL is preserved.'
        );
      } else {
        setSourceType('fetched');
        setExtractionError(null);
      }
    }, 600);
  };

  // Step 3 animation loop
  useEffect(() => {
    if (step !== 3) return;

    const t0 = setTimeout(() => setAnalysisStep(1), 50);
    const t1 = setTimeout(() => setAnalysisStep(2), 700);
    const t2 = setTimeout(() => setAnalysisStep(3), 1400);
    const t3 = setTimeout(() => setAnalysisStep(4), 2100);
    const t4 = setTimeout(() => {
      setIsFinished(true);
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
    }, 2900);

    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [step, jobTitle, jobCompany, jobUrl, sourceType, jobText, requirements, repoUrl, onComplete]);

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

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleManualComplete = () => {
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
  };

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto', padding: '32px 16px' }}>
      {/* 3-Step StepperHeader: Job URL -> Repository -> Analysis */}
      <StepperHeader
        steps={[
          { id: 1, label: 'Job URL' },
          { id: 2, label: 'Repository' },
          { id: 3, label: 'Analysis' },
        ]}
        currentStep={step}
        onStepClick={(s) => {
          if (s < step) setStep(s as 1 | 2 | 3);
        }}
      />

      {/* ==================================================================== */}
      {/* STEP 1: JOB URL & INLINE REQUIREMENTS */}
      {/* ==================================================================== */}
      {step === 1 && (
        <div className="reference-card" style={{ padding: '28px' }}>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '20px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <h2 style={{ fontSize: '19px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text, #E8EEF9)' }}>
                Add a Job Posting
              </h2>
              <p style={{ margin: 0, color: 'var(--muted, #8C9AB8)', fontSize: '13.5px', lineHeight: 1.5 }}>
                Paste a real job URL or upload the job description. We'll extract the requirements and analyze them for your assessment.
              </p>
            </div>

            {/* Persistent SourceBadge */}
            <SourceBadge sourceType={sourceType} sourceUrl={jobUrl} size="md" />
          </div>

          {/* Blocked URL Warning State (BRAIN §17) */}
          {extractionError && (
            <div
              style={{
                backgroundColor: 'rgba(251, 191, 36, 0.1)',
                border: '1px solid rgba(251, 191, 36, 0.3)',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                color: '#FBBF24',
                fontSize: '13px',
                lineHeight: 1.45,
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Automatic fetch blocked:</strong> {extractionError}
              </div>
            </div>
          )}

          {/* Field: Job URL */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text, #E8EEF9)' }}>
                Job URL
              </label>
              {/* Test trigger for edge-case simulation */}
              <button
                type="button"
                onClick={() => handleFetchRequirements(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#FBBF24',
                  fontSize: '11.5px',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                Simulate Blocked URL (403)
              </button>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://careers.google.com/jobs/o..."
                style={{
                  flex: 1,
                  backgroundColor: 'var(--surface-2, #101A30)',
                  border: '1px solid var(--border, #1A2748)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  color: 'var(--text, #E8EEF9)',
                  fontSize: '13.5px',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => handleFetchRequirements(false)}
                disabled={isExtracting || !jobUrl}
                style={{
                  backgroundColor: 'var(--primary, #2F6DF6)',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: '13px',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: isExtracting ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 10px rgba(47, 109, 246, 0.4)',
                }}
              >
                {isExtracting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Fetching...</span>
                  </>
                ) : (
                  <>
                    <Globe size={15} />
                    <span>Fetch Requirements</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* OR Divider */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              margin: '22px 0',
              color: 'var(--muted, #8C9AB8)',
              fontSize: '11.5px',
              fontWeight: 700,
              letterSpacing: '0.08em',
            }}
          >
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border, #1A2748)' }} />
            <span>OR</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border, #1A2748)' }} />
          </div>

          {/* Field: Paste Job Description */}
          <div style={{ marginBottom: '26px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text, #E8EEF9)' }}>
                Paste Job Description
              </label>
              <span style={{ fontSize: '11.5px', color: 'var(--muted, #8C9AB8)' }}>
                {jobText.length}/5000
              </span>
            </div>
            <textarea
              value={jobText}
              onChange={(e) => {
                setJobText(e.target.value);
                setSourceType('user_provided');
              }}
              rows={4}
              maxLength={5000}
              placeholder="Paste the full job description here..."
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
          </div>

          {/* INLINE REQUIREMENTS REVIEW SECTION */}
          <div
            style={{
              paddingTop: '20px',
              borderTop: '1px solid var(--border, #1A2748)',
              marginTop: '10px',
            }}
          >
            {/* AI Extracted Banner */}
            <div style={{ marginBottom: '16px' }}>
              <InfoBanner
                message="AI extracted these, please confirm"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--text, #E8EEF9)' }}>
                Extracted Requirements ({requirements.length})
              </h3>
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
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Plus size={13} />
                <span>Add requirement</span>
              </button>
            </div>

            {/* Editable Requirement Cards Inline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              {requirements.map((req, idx) => (
                <div
                  key={req.id || idx}
                  style={{
                    backgroundColor: 'var(--surface-2, #101A30)',
                    border: '1px solid var(--border, #1A2748)',
                    borderRadius: '10px',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                      <SkillIconTile skill={req.name} size="sm" />
                      <input
                        type="text"
                        value={req.name}
                        onChange={(e) => handleUpdateRequirement(req.id, { name: e.target.value })}
                        style={{
                          backgroundColor: 'transparent',
                          border: 'none',
                          borderBottom: '1px dashed rgba(140, 154, 184, 0.4)',
                          color: 'var(--text, #E8EEF9)',
                          fontSize: '13.5px',
                          fontWeight: 600,
                          padding: '2px 4px',
                          outline: 'none',
                          flex: 1,
                          maxWidth: '220px',
                        }}
                      />
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--muted, #8C9AB8)',
                          backgroundColor: 'rgba(26, 39, 72, 0.6)',
                          padding: '2px 8px',
                          borderRadius: '6px',
                        }}
                      >
                        {req.category}
                      </span>
                    </div>

                    {/* Must / Nice Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateRequirement(req.id, {
                            priority: req.priority === 'must' ? 'nice' : 'must',
                          })
                        }
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 10px',
                          borderRadius: '16px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor:
                            req.priority === 'must'
                              ? 'rgba(52, 211, 153, 0.15)'
                              : 'rgba(148, 163, 184, 0.12)',
                          color: req.priority === 'must' ? '#34D399' : '#94A3B8',
                          border: `1px solid ${
                            req.priority === 'must'
                              ? 'rgba(52, 211, 153, 0.35)'
                              : 'rgba(148, 163, 184, 0.25)'
                          }`,
                          cursor: 'pointer',
                        }}
                      >
                        <span>{req.priority === 'must' ? 'Must have' : 'Nice to have'}</span>
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDeleteRequirement(req.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--muted, #8C9AB8)',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '4px',
                        }}
                        title="Remove requirement"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Source Sentence Quote */}
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--muted, #8C9AB8)',
                      fontStyle: 'italic',
                      backgroundColor: 'rgba(10, 18, 40, 0.4)',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      borderLeft: '2px solid var(--border, #1A2748)',
                    }}
                  >
                    "{req.source_sentence}"
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Footer: Cancel / Next */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '18px',
              borderTop: '1px solid var(--border, #1A2748)',
            }}
          >
            <button
              type="button"
              onClick={onCancel}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid var(--border, #1A2748)',
                color: 'var(--muted, #8C9AB8)',
                padding: '9px 20px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={requirements.length === 0}
              style={{
                backgroundColor: 'var(--primary, #2F6DF6)',
                color: '#FFFFFF',
                padding: '9px 22px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: requirements.length === 0 ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 10px rgba(47, 109, 246, 0.4)',
              }}
            >
              <span>Next</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STEP 2: REPOSITORY ANALYSIS */}
      {/* ==================================================================== */}
      {step === 2 && (
        <div className="reference-card" style={{ padding: '28px' }}>
          {/* Header */}
          <div style={{ marginBottom: '22px' }}>
            <h2 style={{ fontSize: '19px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text, #E8EEF9)' }}>
              Repository Analysis
            </h2>
            <p style={{ margin: 0, color: 'var(--muted, #8C9AB8)', fontSize: '13.5px', lineHeight: 1.5 }}>
              Connect your GitHub repository and select the commit to analyze.
            </p>
          </div>

          {/* Scenario Tester for BRAIN §17 edge cases */}
          <div
            style={{
              backgroundColor: 'var(--surface-2, #101A30)',
              border: '1px solid var(--border, #1A2748)',
              borderRadius: '8px',
              padding: '8px 12px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted, #8C9AB8)' }}>
              TEST SCENARIO:
            </span>
            {(['normal', 'private_repo', 'non_python', 'manual_webhook'] as const).map((scen) => (
              <button
                key={scen}
                type="button"
                onClick={() => setSelectedScenario(scen)}
                style={{
                  backgroundColor: selectedScenario === scen ? 'var(--primary, #2F6DF6)' : 'transparent',
                  color: selectedScenario === scen ? '#FFFFFF' : 'var(--muted, #8C9AB8)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {scen.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Error State: Private / Nonexistent Repo */}
          {selectedScenario === 'private_repo' && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '8px',
                padding: '14px 16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                color: '#EF4444',
                fontSize: '13px',
                lineHeight: 1.45,
              }}
            >
              <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ display: 'block', marginBottom: '2px' }}>
                  Repository Access Error
                </strong>
                Repository not found or private. DevProof requires a public repository or a server-side GITHUB_TOKEN with repository read scope.
              </div>
            </div>
          )}

          {/* Warning State: Non-Python Repo */}
          {selectedScenario === 'non_python' && (
            <div
              style={{
                backgroundColor: 'rgba(251, 191, 36, 0.1)',
                border: '1px solid rgba(251, 191, 36, 0.35)',
                borderRadius: '8px',
                padding: '14px 16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                color: '#FBBF24',
                fontSize: '13px',
                lineHeight: 1.45,
              }}
            >
              <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ display: 'block', marginBottom: '2px' }}>
                  Unsupported Codebase Scope
                </strong>
                MVP analyzes Python backends; analyzed 0 supported files. Status will be marked Unable to assess.
              </div>
            </div>
          )}

          {/* Connected Repo Card (Matching reference.png) */}
          <div
            style={{
              backgroundColor: 'var(--surface-2, #101A30)',
              border: '1px solid var(--border, #1A2748)',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {/* GitHub Cat Icon Tile */}
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(26, 39, 72, 0.8)',
                  border: '1px solid var(--border, #1A2748)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text, #E8EEF9)',
                }}
              >
                <GitBranch size={20} />
              </div>

              <div>
                <div style={{ fontSize: '11.5px', color: 'var(--muted, #8C9AB8)', marginBottom: '2px' }}>
                  GitHub Repository
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text, #E8EEF9)' }}>
                    {selectedScenario === 'private_repo'
                      ? 'rohan-student/private-repo'
                      : selectedScenario === 'non_python'
                      ? 'rohan-student/frontend-portfolio'
                      : 'rohan-student/student-api'}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: 'rgba(52, 211, 153, 0.12)',
                      color: '#34D399',
                      border: '1px solid rgba(52, 211, 153, 0.25)',
                      padding: '1px 7px',
                      borderRadius: '10px',
                    }}
                  >
                    Public
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsEditingRepo(!isEditingRepo)}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid var(--border, #1A2748)',
                color: 'var(--text, #E8EEF9)',
                fontSize: '12px',
                fontWeight: 600,
                padding: '6px 14px',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              {isEditingRepo ? 'Done' : 'Change'}
            </button>
          </div>

          {/* Editable Repo URL input if user clicked Change */}
          {isEditingRepo && (
            <div style={{ marginBottom: '20px' }}>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repository"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  backgroundColor: 'var(--surface-2, #101A30)',
                  border: '1px solid var(--border, #1A2748)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  color: 'var(--text, #E8EEF9)',
                  fontSize: '13.5px',
                  outline: 'none',
                }}
              />
            </div>
          )}

          {/* Commit SHA Field (Read-only, Latest Chip, Pin-able) */}
          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text, #E8EEF9)', marginBottom: '6px' }}>
              Commit SHA
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--surface-2, #101A30)',
                border: '1px solid var(--border, #1A2748)',
                borderRadius: '8px',
                padding: '4px 8px 4px 14px',
              }}
            >
              <input
                type="text"
                readOnly
                value={commitSha}
                style={{
                  flex: 1,
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'var(--text, #E8EEF9)',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  outline: 'none',
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    backgroundColor: 'rgba(52, 211, 153, 0.15)',
                    color: '#34D399',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    border: '1px solid rgba(52, 211, 153, 0.3)',
                  }}
                >
                  Latest
                </span>

                <button
                  type="button"
                  onClick={() => setIsPinnedSha(!isPinnedSha)}
                  title={isPinnedSha ? 'Commit pinned' : 'Pin to this commit SHA'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: isPinnedSha ? 'var(--primary, #2F6DF6)' : 'rgba(26, 39, 72, 0.6)',
                    color: isPinnedSha ? '#FFFFFF' : 'var(--muted, #8C9AB8)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '5px 10px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Pin size={12} />
                  <span>{isPinnedSha ? 'Pinned' : 'Pin SHA'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Validation Results Card */}
          <div
            style={{
              backgroundColor: 'var(--surface-2, #101A30)',
              border: '1px solid var(--border, #1A2748)',
              borderRadius: '10px',
              padding: '16px 18px',
              marginBottom: '20px',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted, #8C9AB8)', marginBottom: '10px', letterSpacing: '0.04em' }}>
              REPOSITORY VALIDATION
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '13px' }}>
              <div>
                <span style={{ color: 'var(--muted, #8C9AB8)' }}>Default Branch: </span>
                <strong style={{ color: 'var(--text, #E8EEF9)' }}>main</strong>
              </div>
              <div>
                <span style={{ color: 'var(--muted, #8C9AB8)' }}>Analyzable Files: </span>
                <strong style={{ color: 'var(--text, #E8EEF9)' }}>
                  {selectedScenario === 'non_python' ? '0 files' : '6 Python files'}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--muted, #8C9AB8)' }}>Scope: </span>
                <strong style={{ color: 'var(--text, #E8EEF9)' }}>
                  {selectedScenario === 'non_python'
                    ? '0 analyzed, 18 skipped'
                    : '6 analyzed, 2 skipped (1 docs, 1 venv)'}
                </strong>
              </div>
            </div>
          </div>

          {/* Webhook Status Card */}
          <div
            style={{
              backgroundColor: 'var(--surface-2, #101A30)',
              border: '1px solid var(--border, #1A2748)',
              borderRadius: '10px',
              padding: '16px 18px',
              marginBottom: '26px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted, #8C9AB8)', letterSpacing: '0.04em' }}>
                WEBHOOK STATUS
              </div>
              {selectedScenario !== 'manual_webhook' ? (
                <span
                  style={{
                    backgroundColor: 'rgba(52, 211, 153, 0.15)',
                    color: '#34D399',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    border: '1px solid rgba(52, 211, 153, 0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Check size={11} strokeWidth={3} />
                  <span>Webhook registered</span>
                </span>
              ) : (
                <span
                  style={{
                    backgroundColor: 'rgba(251, 191, 36, 0.15)',
                    color: '#FBBF24',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    border: '1px solid rgba(251, 191, 36, 0.3)',
                  }}
                >
                  Manual setup required
                </span>
              )}
            </div>

            {selectedScenario === 'manual_webhook' ? (
              <div style={{ marginTop: '10px', fontSize: '12.5px', color: 'var(--muted, #8C9AB8)' }}>
                <p style={{ margin: '0 0 10px 0' }}>
                  Auto-registration failed (PAT lacking admin:repo_hook). Configure in your GitHub repo settings:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(10, 18, 40, 0.5)', padding: '6px 10px', borderRadius: '6px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '11.5px', color: 'var(--text, #E8EEF9)' }}>
                      Payload URL: http://localhost:8000/api/webhooks/github
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('http://localhost:8000/api/webhooks/github', 'url')}
                      style={{ background: 'none', border: 'none', color: '#60A5FA', cursor: 'pointer', padding: 0 }}
                    >
                      {copiedField === 'url' ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(10, 18, 40, 0.5)', padding: '6px 10px', borderRadius: '6px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '11.5px', color: 'var(--text, #E8EEF9)' }}>
                      Secret: whsec_devproof_local_demo
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('whsec_devproof_local_demo', 'sec')}
                      style={{ background: 'none', border: 'none', color: '#60A5FA', cursor: 'pointer', padding: 0 }}
                    >
                      {copiedField === 'sec' ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '12.5px', color: 'var(--muted, #8C9AB8)' }}>
                GitHub push events will automatically trigger continuous reassessment.
              </div>
            )}
          </div>

          {/* Action Footer: Back / Start Analysis */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '18px',
              borderTop: '1px solid var(--border, #1A2748)',
            }}
          >
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid var(--border, #1A2748)',
                color: 'var(--muted, #8C9AB8)',
                padding: '9px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <ArrowLeft size={15} />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={() => setStep(3)}
              disabled={selectedScenario === 'private_repo'}
              style={{
                backgroundColor: 'var(--primary, #2F6DF6)',
                color: '#FFFFFF',
                padding: '10px 24px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: selectedScenario === 'private_repo' ? 'not-allowed' : 'pointer',
                opacity: selectedScenario === 'private_repo' ? 0.5 : 1,
                boxShadow: '0 2px 10px rgba(47, 109, 246, 0.4)',
              }}
            >
              Start Analysis
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STEP 3: ANALYSIS CHECKLIST */}
      {/* ==================================================================== */}
      {step === 3 && (
        <div className="reference-card" style={{ padding: '32px' }}>
          {/* Header */}
          <div style={{ marginBottom: '24px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text, #E8EEF9)' }}>
              Analyzing Repository
            </h2>
            <p style={{ margin: '0 auto', maxWidth: '480px', color: 'var(--muted, #8C9AB8)', fontSize: '13.5px', lineHeight: 1.5 }}>
              Evaluating repository evidence against extracted job requirements.
            </p>
          </div>

          {/* Progress Checklist (Matching reference.png) */}
          <div
            style={{
              maxWidth: '460px',
              margin: '0 auto 28px auto',
              backgroundColor: 'var(--surface-2, #101A30)',
              border: '1px solid var(--border, #1A2748)',
              borderRadius: '12px',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Checklist Item 1 */}
            <ChecklistItem
              label="Fetching repository data"
              status={analysisStep >= 1 ? (analysisStep > 1 ? 'completed' : 'partial') : 'pending'}
            />

            {/* Checklist Item 2 */}
            <ChecklistItem
              label="Scanning files and code"
              status={analysisStep >= 2 ? (analysisStep > 2 ? 'completed' : 'partial') : 'pending'}
            />

            {/* Checklist Item 3 */}
            <ChecklistItem
              label="Matching skills with requirements"
              status={analysisStep >= 3 ? (analysisStep > 3 ? 'completed' : 'partial') : 'pending'}
            />

            {/* Checklist Item 4 */}
            <ChecklistItem
              label="Generating evidence"
              status={analysisStep >= 4 ? 'completed' : 'pending'}
            />
          </div>

          {/* Subtext Notice */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted, #8C9AB8)', fontStyle: 'italic' }}>
              This may take a few minutes…
            </p>
          </div>

          {/* Fallback button if user wants to proceed immediately */}
          <div style={{ textAlign: 'center' }}>
            <button
              type="button"
              onClick={handleManualComplete}
              style={{
                backgroundColor: isFinished ? 'var(--primary, #2F6DF6)' : 'transparent',
                border: isFinished ? 'none' : '1px solid var(--border, #1A2748)',
                color: isFinished ? '#FFFFFF' : 'var(--muted, #8C9AB8)',
                padding: '9px 20px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>{isFinished ? 'View Assessment Results →' : 'Skip waiting and view results'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
