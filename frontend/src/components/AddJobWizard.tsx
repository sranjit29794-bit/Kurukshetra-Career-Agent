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
} from 'lucide-react';
import type { JobDraft, Requirement, SourceType, ResumeDraftData } from '../types';
import { StepperHeader, type StepItem } from './StepperHeader';
import { SourceBadge } from './SourceBadge';
import { SkillIconTile } from './SkillIconTile';
import { InfoBanner } from './InfoBanner';
import { api } from '../lib/api';
import resumeFixture from '../../../docs/fixtures/resume_draft.json';

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

interface MockRepoItem {
  id: string;
  name: string;
  fullName: string;
  description: string;
  stars: number;
  analyzableFiles: number;
  language: string;
}

export const AddJobWizard: React.FC<AddJobWizardProps> = ({
  onComplete,
  onCancel,
  onViewClaimsMatrix,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // --- Step 1 State: Job Source & Requirements ---
  const [sourceType, setSourceType] = useState<SourceType>('fetched');
  const [jobUrl, setJobUrl] = useState<string>('https://boards-api.greenhouse.io/v1/boards/kinetik/jobs/5239102');
  const [jobText, setJobText] = useState<string>(
    'We are looking for a Backend Engineering Intern proficient in Python and FastAPI to build clean REST APIs. You will work with SQL databases, write unit and integration tests, and help containerize services for deployment with GitHub Actions CI/CD pipelines.'
  );
  const [jobTitle] = useState<string>('Backend Engineering Intern (Python/FastAPI)');
  const [jobCompany] = useState<string>('Kinetik Health');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  const [requirements, setRequirements] = useState<Requirement[]>([
    {
      id: 'req_python',
      name: 'Python',
      category: 'Language',
      priority: 'must',
      source_sentence: 'Proficient in Python.',
      taxonomy_key: 'python_lang',
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

  // --- Step 2 State: Resume ---
  const [resumeMode, setResumeMode] = useState<'upload' | 'paste'>('upload');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumePasteText, setResumePasteText] = useState<string>('');
  const [isParsingResume, setIsParsingResume] = useState<boolean>(false);
  const [isScannedPdfWarning, setIsScannedPdfWarning] = useState<boolean>(false);
  const [parsedResume] = useState<ResumeDraftData>(
    resumeFixture as unknown as ResumeDraftData
  );

  // --- Step 3 State: Repositories ---
  const [githubUsername, setGithubUsername] = useState<string>('rohan-builds');
  const [mockRepos] = useState<MockRepoItem[]>([
    {
      id: 'repo_student_api',
      name: 'student-api',
      fullName: 'rohan-builds/student-api',
      description: 'Inventory management REST API built with FastAPI and SQLite',
      stars: 4,
      analyzableFiles: 6,
      language: 'Python',
    },
    {
      id: 'repo_portfolio',
      name: 'portfolio-site',
      fullName: 'rohan-builds/portfolio-site',
      description: 'Personal portfolio website and blog',
      stars: 2,
      analyzableFiles: 1,
      language: 'TypeScript',
    },
    {
      id: 'repo_data_pipeline',
      name: 'etl-pipeline',
      fullName: 'rohan-builds/etl-pipeline',
      description: 'Async batch data ingestion scripts and tests',
      stars: 7,
      analyzableFiles: 8,
      language: 'Python',
    },
    {
      id: 'repo_cloud_service',
      name: 'cloud-deploy-demo',
      fullName: 'rohan-builds/cloud-deploy-demo',
      description: 'Docker compose and terraform config for AWS ECS deployment',
      stars: 1,
      analyzableFiles: 4,
      language: 'HCL / Dockerfile',
    },
  ]);
  const [selectedRepoFullNames, setSelectedRepoFullNames] = useState<string[]>([
    'rohan-builds/student-api',
  ]);
  const [selectedBranches, setSelectedBranches] = useState<Record<string, string>>({
    'rohan-builds/student-api': 'main',
  });

  // --- Step 4 State: Analysis Checklist Progress ---
  const [analysisStage, setAnalysisStage] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  // Handle URL fetch via real backend endpoint
  const handleFetchRequirements = async () => {
    if (!jobUrl.trim()) return;
    setIsExtracting(true);
    setExtractionError(null);

    try {
      const res = await api.extractJob({ url: jobUrl.trim() });
      if ('status' in res && res.status === 'needs_paste') {
        setSourceType('user_provided');
        setExtractionError(
          'LinkedIn / external site requires login authentication. Switched to manual paste mode. Your source URL is preserved.'
        );
      } else {
        const draft = res as JobDraft;
        setSourceType('fetched');
        setExtractionError(null);
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

  // Step 4 analysis progress animation
  useEffect(() => {
    if (step !== 4) return;

    const t1 = setTimeout(() => setAnalysisStage(1), 200);   // Fetching
    const t2 = setTimeout(() => setAnalysisStage(2), 1000);  // Scanning
    const t3 = setTimeout(() => setAnalysisStage(3), 1900);  // Judging
    const t4 = setTimeout(() => {
      setAnalysisStage(4);                                   // Complete
      setIsFinished(true);
    }, 2800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
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

  // Handle file drop / upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResumeFile(file);
    setIsParsingResume(true);
    setIsScannedPdfWarning(false);

    setTimeout(() => {
      setIsParsingResume(false);
      // Simulate scanned PDF check if filename contains scanned
      if (file.name.toLowerCase().includes('scanned') || file.size < 500) {
        setIsScannedPdfWarning(true);
      } else {
        setIsScannedPdfWarning(false);
      }
    }, 500);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') {
      setResumeFile(file);
      setIsParsingResume(true);
      setTimeout(() => {
        setIsParsingResume(false);
        if (file.name.toLowerCase().includes('scanned')) {
          setIsScannedPdfWarning(true);
        }
      }, 500);
    }
  };

  // Handle repo selection with max 3 rule
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
      }
    }
  };

  const handleCompleteWizard = () => {
    const primaryRepo = selectedRepoFullNames[0] || 'rohan-builds/student-api';
    const primaryUrl = `https://github.com/${primaryRepo}`;

    const finalDraft: JobDraft = {
      id: `job_${Date.now()}`,
      title: jobTitle,
      company: jobCompany,
      source_url: jobUrl,
      source_type: sourceType,
      raw_text: jobText,
      requirements,
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
          </div>

          {/* Extracted Requirements Review List */}
          <div style={{ paddingTop: '20px', borderTop: '1px solid var(--border, #1A2748)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 2px', color: 'var(--text, #E8EEF9)' }}>
                  Technical Requirements ({requirements.length})
                </h3>
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              {requirements.map((req) => (
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
              ))}
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
                  cursor: 'pointer',
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
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          ) : (
            <div style={{ marginBottom: '20px' }}>
              <textarea
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
            </div>
          )}

          {/* Scanned PDF Warning per IN-3 specs */}
          {isScannedPdfWarning && (
            <div style={{ marginBottom: '18px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: 'rgba(251, 191, 36, 0.1)',
                  border: '1px solid rgba(251, 191, 36, 0.3)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  color: '#FBBF24',
                  fontSize: '13px',
                }}
              >
                <AlertTriangle size={18} />
                <span>
                  No selectable text found in this PDF (likely scanned or image-only). Please switch to the &quot;Paste Resume Text&quot; tab above.
                </span>
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
                  {item.source_line && (
                    <span style={{ opacity: 0.6, fontSize: '11px' }}>(L{item.source_line})</span>
                  )}
                </span>
              ))}
            </div>

            {/* Extracted GitHub Links */}
            <div style={{ fontSize: '12px', color: 'var(--muted, #8C9AB8)' }}>
              <strong>Extracted GitHub Links: </strong>
              {parsedResume.repo_candidates.map((cand, idx) => (
                <span key={idx} style={{ color: 'var(--text, #E8EEF9)', marginLeft: '6px' }}>
                  {cand.url} ({cand.source})
                  {idx < parsedResume.repo_candidates.length - 1 ? ',' : ''}
                </span>
              ))}
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

          {/* GitHub Username Filter */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text, #E8EEF9)', marginBottom: '6px' }}>
              GitHub Username
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--surface-2, #101A30)',
                border: '1px solid var(--border, #1A2748)',
                borderRadius: '8px',
                padding: '8px 12px',
                gap: '8px',
                maxWidth: '360px',
              }}
            >
              <GitBranch size={16} color="var(--muted, #8C9AB8)" />
              <input
                type="text"
                value={githubUsername}
                onChange={(e) => setGithubUsername(e.target.value)}
                placeholder="rohan-builds"
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
          </div>

          {/* Repo Selection Notice (<= 3 repos enforced) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text, #E8EEF9)' }}>
              Available Repositories ({selectedRepoFullNames.length}/3 selected)
            </span>
            <span style={{ fontSize: '12px', color: 'var(--muted, #8C9AB8)' }}>
              Maximum 3 repositories per job assessment track
            </span>
          </div>

          {/* Repositories List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
            {mockRepos.map((repo) => {
              const isSelected = selectedRepoFullNames.includes(repo.fullName);
              const isDisabled = !isSelected && selectedRepoFullNames.length >= 3;

              return (
                <div
                  key={repo.id}
                  onClick={() => !isDisabled && handleToggleRepo(repo.fullName)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    backgroundColor: isSelected ? 'rgba(47, 109, 246, 0.08)' : 'var(--surface-2, #101A30)',
                    border: `1px solid ${isSelected ? 'var(--primary, #2F6DF6)' : 'var(--border, #1A2748)'}`,
                    borderRadius: '8px',
                    padding: '14px 16px',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    opacity: isDisabled ? 0.5 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isDisabled}
                    onChange={() => handleToggleRepo(repo.fullName)}
                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text, #E8EEF9)' }}>
                        {repo.fullName}
                      </span>
                      <span
                        style={{
                          backgroundColor: 'var(--surface-1, #0A1224)',
                          border: '1px solid var(--border, #1A2748)',
                          borderRadius: '4px',
                          padding: '1px 6px',
                          fontSize: '11px',
                          color: 'var(--muted, #8C9AB8)',
                        }}
                      >
                        {repo.language}
                      </span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--muted, #8C9AB8)', marginTop: '2px' }}>
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
              );
            })}
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
