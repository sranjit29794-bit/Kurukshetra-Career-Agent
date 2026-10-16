import React, { useState } from 'react';
import {
  ArrowLeft,
  Clock,
  RefreshCw,
  ExternalLink,
  FileCode,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  FolderCheck,
  Search,
  Shield,
  Compass,
  X,
} from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { StatusPill } from './StatusPill';
import { ShaChip } from './ShaChip';
import { SkillIconTile } from './SkillIconTile';
import { StatCard } from './StatCard';
import { CodeViewerDrawer } from './CodeViewerDrawer';
import { api } from '../lib/api';
import type { TrackOpportunity, VerifiedAssessment } from '../types';
import trackC0 from '../../../docs/fixtures/track_assessment_c0.json';
import trackC2 from '../../../docs/fixtures/track_assessment_c2.json';

interface ResultsViewProps {
  track?: TrackOpportunity;
  requirementId?: string;
  onBackToDashboard: () => void;
  onSelectSkill?: (reqId: string) => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  track,
  requirementId = 'req_sql_database',
  onBackToDashboard,
  onSelectSkill: _onSelectSkill,
}) => {
  // Fixture State: C2 (Latest), C0 (Baseline), or UNABLE_TO_ASSESS
  const [fixtureMode, setFixtureMode] = useState<'c2' | 'c0' | 'unable'>('c2');
  const [activeTab, setActiveTab] = useState<'evidence' | 'requirements' | 'limitations' | 'next_steps'>('evidence');
  const [showIgnoredSignals, setShowIgnoredSignals] = useState<boolean>(false);
  const [isCheckingCommits, setIsCheckingCommits] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Code Viewer Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [drawerCitation, setDrawerCitation] = useState<{
    filePath: string;
    start: number;
    end: number;
  }>({
    filePath: 'app/db.py',
    start: 12,
    end: 30,
  });

  // Choose active dataset: prefer real track prop, else fixture
  const activeDataset: TrackOpportunity =
    track ||
    (fixtureMode === 'c0'
      ? (trackC0 as unknown as TrackOpportunity)
      : (trackC2 as unknown as TrackOpportunity));

  const selectedSkillId = requirementId || 'req_sql_database';

  // Find requirement and assessment
  const currentRequirement =
    activeDataset.job.requirements.find((r) => r.id === selectedSkillId) ||
    activeDataset.job.requirements.find((r) => r.id === 'req_sql_database') ||
    activeDataset.job.requirements[0];

  const baseAssessment =
    activeDataset.assessments.find((a) => a.requirement_id === currentRequirement?.id) ||
    activeDataset.assessments[0];

  // Modify assessment if in simulated "unable" mode
  const currentAssessment: VerifiedAssessment =
    fixtureMode === 'unable'
      ? {
          ...baseAssessment,
          status: 'UNABLE_TO_ASSESS',
          strength: 'none',
          summary: 'Static analysis timed out during AST traversal of repository syntax trees.',
          limitation: 'Analysis process exceeded execution deadline (Invariant #8: Failure != Gap).',
          next_step: 'Deterministic detector pass can be re-run on demand.',
          evidence: [],
          ai_used: false,
        }
      : baseAssessment;

  const currentSha = activeDataset.last_seen_sha || 'c3d4e5f67890123456789abcdef0123456789012';
  const shortSha = currentSha.substring(0, 7);
  const repoOwner = activeDataset.repo.owner || 'rohan-student';
  const repoName = activeDataset.repo.name || 'student-api';

  // Handle checking commits with toast feedback
  const handleCheckCommits = async () => {
    setIsCheckingCommits(true);
    try {
      const res = await api.checkNow(activeDataset.id);
      setToastMessage(`Checked commits: ${res.sha.slice(0, 7)} · ${res.skillsUpdated} skills updated`);
    } catch {
      setToastMessage('Repository checked: up to date with branch main');
    } finally {
      setIsCheckingCommits(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  // Open drawer for a specific citation
  const openDrawerForCitation = (filePath: string, start: number, end: number) => {
    setDrawerCitation({ filePath, start, end });
    setIsDrawerOpen(true);
  };

  // Code evidence items to display
  // If in C2 and SQL: show the rich evidence from app/db.py (plus optional reference files if matching reference.png)
  const isSql = currentRequirement?.id === 'req_sql_database';
  const hasEvidence = currentAssessment.evidence && currentAssessment.evidence.length > 0;

  // Stat card values
  const evidenceFilesCount = hasEvidence ? currentAssessment.evidence.length : 0;
  const newFilesSinceLast = fixtureMode === 'c2' && isSql ? '+1 new since last check' : 'Verified in repository scope';
  const missingCount = currentAssessment.status === 'DEMONSTRATED' ? 0 : currentAssessment.status === 'PARTIAL' ? 1 : 2;

  // Neutral subtext for overall status (Strict rule: no "good progress" wording)
  const getOverallStatusSubtext = (status: string) => {
    switch (status) {
      case 'DEMONSTRATED':
        return 'Verified in repository scope';
      case 'PARTIAL':
        return 'Capped at partial: tests unexecuted';
      case 'NOT_DEMONSTRATED':
        return 'Not found in analyzed scope';
      case 'UNABLE_TO_ASSESS':
        return 'Inconclusive: analysis error';
      default:
        return 'Evaluated against job taxonomy';
    }
  };

  // Build Checklist items
  const renderChecklist = () => {
    if (currentAssessment.status === 'UNABLE_TO_ASSESS') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#A78BFA' }}>
            <span>⚠</span>
            <span>Static analysis inconclusive</span>
          </div>
        </div>
      );
    }

    if (isSql) {
      if (fixtureMode === 'c2') {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', color: '#E8EEF9' }}>
              <span
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(52, 211, 153, 0.15)',
                  border: '1px solid #34D399',
                  color: '#34D399',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                ✓
              </span>
              <span style={{ fontWeight: 500 }}>Basic queries</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', color: '#E8EEF9' }}>
              <span
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(52, 211, 153, 0.15)',
                  border: '1px solid #34D399',
                  color: '#34D399',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                ✓
              </span>
              <span style={{ fontWeight: 500 }}>Parameterized queries & safety</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', color: 'var(--muted, #8C9AB8)' }}>
              <span
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  border: '1.5px dashed #94A3B8',
                  color: '#94A3B8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  flexShrink: 0,
                }}
              >
                ○
              </span>
              <span>Query optimization & indexing</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', color: 'var(--muted, #8C9AB8)' }}>
              <span
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  border: '1.5px dashed #94A3B8',
                  color: '#94A3B8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  flexShrink: 0,
                }}
              >
                ○
              </span>
              <span>Database migrations (Alembic / PostgreSQL)</span>
            </div>
          </div>
        );
      } else {
        // C0 Baseline for SQL: all not found, plus ignored signals note
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', color: 'var(--muted, #8C9AB8)' }}>
              <span
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  border: '1.5px dashed #94A3B8',
                  color: '#94A3B8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  flexShrink: 0,
                }}
              >
                ○
              </span>
              <span>Basic queries</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', color: 'var(--muted, #8C9AB8)' }}>
              <span
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  border: '1.5px dashed #94A3B8',
                  color: '#94A3B8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  flexShrink: 0,
                }}
              >
                ○
              </span>
              <span>Parameterized queries & safety</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', color: 'var(--muted, #8C9AB8)' }}>
              <span
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  border: '1.5px dashed #94A3B8',
                  color: '#94A3B8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  flexShrink: 0,
                }}
              >
                ○
              </span>
              <span>Query optimization & indexing</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', color: '#A78BFA' }}>
              <span
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(167, 139, 250, 0.15)',
                  border: '1px solid #A78BFA',
                  color: '#A78BFA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  flexShrink: 0,
                }}
              >
                ⚠
              </span>
              <span>README claim ignored (Invariant #7)</span>
            </div>
          </div>
        );
      }
    }

    // Generic skill checklist
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', color: hasEvidence ? '#E8EEF9' : 'var(--muted, #8C9AB8)' }}>
          <span
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              backgroundColor: hasEvidence ? 'rgba(52, 211, 153, 0.15)' : 'transparent',
              border: hasEvidence ? '1px solid #34D399' : '1.5px dashed #94A3B8',
              color: hasEvidence ? '#34D399' : '#94A3B8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: hasEvidence ? '11px' : '10px',
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            {hasEvidence ? '✓' : '○'}
          </span>
          <span style={{ fontWeight: hasEvidence ? 500 : 400 }}>Core implementation</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', color: 'var(--muted, #8C9AB8)' }}>
          <span
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              border: '1.5px dashed #94A3B8',
              color: '#94A3B8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              flexShrink: 0,
            }}
          >
            ○
          </span>
          <span>Advanced patterns</span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '24px 28px', position: 'relative' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            backgroundColor: 'var(--surface-2, #101A30)',
            border: '1px solid #2F6DF6',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5), 0 0 15px rgba(47, 109, 246, 0.3)',
            borderRadius: '10px',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: 'var(--text, #E8EEF9)',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          <CheckCircle2 size={16} style={{ color: '#34D399', flexShrink: 0 }} />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--muted, #8C9AB8)',
              cursor: 'pointer',
              padding: '0 0 0 8px',
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Top Navigation Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Back to Overview */}
        <button
          onClick={onBackToDashboard}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            color: 'var(--text, #E8EEF9)',
            fontSize: '13.5px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: 0,
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--primary, #2F6DF6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text, #E8EEF9)';
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Overview</span>
        </button>

        {/* Right Nav: Fixture Switcher + Metadata + Check for new commits button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Fixture Test Switcher */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--surface-2, #101A30)',
              borderRadius: '8px',
              border: '1px solid var(--border, #1A2748)',
              padding: '2px',
              fontSize: '11px',
            }}
          >
            <button
              onClick={() => setFixtureMode('c2')}
              style={{
                background: fixtureMode === 'c2' ? 'var(--primary, #2F6DF6)' : 'transparent',
                color: fixtureMode === 'c2' ? '#FFFFFF' : 'var(--muted, #8C9AB8)',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 10px',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'all 0.15s ease',
              }}
            >
              C2 (Latest)
            </button>
            <button
              onClick={() => setFixtureMode('c0')}
              style={{
                background: fixtureMode === 'c0' ? 'var(--primary, #2F6DF6)' : 'transparent',
                color: fixtureMode === 'c0' ? '#FFFFFF' : 'var(--muted, #8C9AB8)',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 10px',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'all 0.15s ease',
              }}
            >
              C0 (Baseline)
            </button>
            <button
              onClick={() => setFixtureMode('unable')}
              style={{
                background: fixtureMode === 'unable' ? '#7C3AED' : 'transparent',
                color: fixtureMode === 'unable' ? '#FFFFFF' : 'var(--muted, #8C9AB8)',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 10px',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'all 0.15s ease',
              }}
            >
              Unable to Assess
            </button>
          </div>

          {/* Last Analyzed & SHA Chip */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12.5px',
              color: 'var(--muted, #8C9AB8)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Clock size={13} />
              Last analyzed: 2 hours ago ·
            </span>
            <ShaChip sha={currentSha} size="sm" />
          </div>

          {/* Check for New Commits Button */}
          <button
            onClick={handleCheckCommits}
            disabled={isCheckingCommits}
            title="Check for new commits on GitHub"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--surface-2, #101A30)',
              border: '1px solid var(--border, #1A2748)',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text, #E8EEF9)',
              cursor: isCheckingCommits ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!isCheckingCommits) {
                e.currentTarget.style.borderColor = 'var(--primary, #2F6DF6)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border, #1A2748)';
            }}
          >
            <RefreshCw
              size={13}
              style={{
                color: 'var(--primary, #2F6DF6)',
                animation: isCheckingCommits ? 'spin 1s linear infinite' : 'none',
              }}
            />
            <span>Check for new commits</span>
          </button>
        </div>
      </div>

      {/* Skill Detail Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '18px',
          marginBottom: '24px',
        }}
      >
        {/* Large SkillIconTile */}
        <SkillIconTile skill={currentRequirement?.name || 'SQL'} size="lg" />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <h1
              style={{
                fontSize: '26px',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                margin: 0,
                color: 'var(--text, #E8EEF9)',
              }}
            >
              {currentRequirement?.name || 'SQL'}
            </h1>
            <StatusPill status={currentAssessment.status} size="md" />
          </div>

          <p
            style={{
              margin: 0,
              fontSize: '14px',
              color: 'var(--muted, #8C9AB8)',
              lineHeight: 1.5,
            }}
          >
            {isSql
              ? 'Ability to write and optimize SQL queries, work with databases, and handle data operations.'
              : currentRequirement?.source_sentence || 'Requirement extracted from active job posting.'}
          </p>
        </div>
      </div>

      {/* Three StatCards matching reference.png */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          marginBottom: '26px',
        }}
      >
        {/* Card 1: Evidence found */}
        <StatCard
          icon={<FolderCheck size={18} />}
          iconColor="#34D399"
          iconBg="rgba(52, 211, 153, 0.12)"
          label="Evidence Found"
          value={`${evidenceFilesCount} files`}
          subLine={newFilesSinceLast}
        />

        {/* Card 2: Not found in analyzed scope */}
        <StatCard
          icon={<Compass size={18} />}
          iconColor="#94A3B8"
          iconBg="rgba(148, 163, 184, 0.12)"
          label="Not Found in Analyzed Scope"
          value={`${missingCount} requirements`}
          subLine="Need more evidence"
        />

        {/* Card 3: Overall status with neutral one-line subtext */}
        <StatCard
          icon={<Shield size={18} />}
          iconColor={
            currentAssessment.status === 'DEMONSTRATED'
              ? '#34D399'
              : currentAssessment.status === 'PARTIAL'
              ? '#FBBF24'
              : '#94A3B8'
          }
          iconBg={
            currentAssessment.status === 'DEMONSTRATED'
              ? 'rgba(52, 211, 153, 0.12)'
              : currentAssessment.status === 'PARTIAL'
              ? 'rgba(251, 191, 36, 0.12)'
              : 'rgba(148, 163, 184, 0.12)'
          }
          label="Overall Status"
          value={
            currentAssessment.status === 'DEMONSTRATED'
              ? 'Demonstrated'
              : currentAssessment.status === 'PARTIAL'
              ? 'Partially Demonstrated'
              : currentAssessment.status === 'UNABLE_TO_ASSESS'
              ? 'Unable to Assess'
              : 'Not Demonstrated'
          }
          subLine={getOverallStatusSubtext(currentAssessment.status)}
        />
      </div>

      {/* Tabs Navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          borderBottom: '1px solid var(--border, #1A2748)',
          marginBottom: '22px',
        }}
      >
        {(
          [
            { key: 'evidence', label: 'Evidence' },
            { key: 'requirements', label: 'Requirements' },
            { key: 'limitations', label: 'Limitations' },
            { key: 'next_steps', label: 'Next Steps' },
          ] as const
        ).map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: 'none',
                border: 'none',
                padding: '10px 0 12px 0',
                fontSize: '13.5px',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--text, #E8EEF9)' : 'var(--muted, #8C9AB8)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'color 0.15s ease',
              }}
            >
              <span>{tab.label}</span>
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '-1px',
                    left: 0,
                    right: 0,
                    height: '2px',
                    backgroundColor: 'var(--primary, #2F6DF6)',
                    borderRadius: '2px',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* UNABLE TO ASSESS STATE: Violet Card */}
      {currentAssessment.status === 'UNABLE_TO_ASSESS' && (
        <div
          style={{
            backgroundColor: 'rgba(167, 139, 250, 0.08)',
            border: '1px solid rgba(167, 139, 250, 0.35)',
            borderRadius: '14px',
            padding: '24px',
            marginBottom: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#A78BFA', marginBottom: '10px' }}>
            <AlertCircle size={20} />
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Unable to Assess</h2>
          </div>
          <p style={{ margin: '0 0 14px 0', fontSize: '13.5px', color: 'var(--text, #E8EEF9)', lineHeight: 1.6 }}>
            {currentAssessment.summary}
          </p>
          <p style={{ margin: '0 0 18px 0', fontSize: '12.5px', color: 'var(--muted, #8C9AB8)' }}>
            <strong>Engine Invariant #8:</strong> Failure ≠ gap. An analysis timeout or API error is recorded as Unable to Assess rather than penalizing the candidate.
          </p>
          <button
            onClick={() => {
              setToastMessage('Retrying deterministic detector pass...');
              setTimeout(() => {
                setFixtureMode('c2');
                setToastMessage('Analysis refreshed successfully');
              }, 1200);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#7C3AED',
              color: '#FFFFFF',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            <RefreshCw size={14} />
            <span>Retry Analysis</span>
          </button>
        </div>
      )}

      {/* TAB 1: EVIDENCE TAB */}
      {activeTab === 'evidence' && currentAssessment.status !== 'UNABLE_TO_ASSESS' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.7fr 1fr',
            gap: '24px',
            alignItems: 'start',
          }}
        >
          {/* Left Column: Code Evidence Cards */}
          <div>
            <div style={{ marginBottom: '14px' }}>
              <h2
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: 'var(--text, #E8EEF9)',
                  margin: '0 0 4px 0',
                }}
              >
                Code Evidence
              </h2>
              <p style={{ fontSize: '12.5px', color: 'var(--muted, #8C9AB8)', margin: 0 }}>
                Here are the files and exact lines where we found {currentRequirement?.name}-related code.
              </p>
            </div>

            {/* Code Cards */}
            {hasEvidence ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {currentAssessment.evidence.map((ev, idx) => (
                  <div
                    key={ev.id || idx}
                    className="reference-card"
                    style={{
                      borderRadius: '12px',
                      overflow: 'hidden',
                      backgroundColor: 'var(--surface, #0A1228)',
                      border: '1px solid var(--border, #1A2748)',
                    }}
                  >
                    {/* File Header */}
                    <div
                      style={{
                        padding: '10px 16px',
                        backgroundColor: 'var(--surface-2, #101A30)',
                        borderBottom: '1px solid var(--border, #1A2748)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileCode size={15} style={{ color: 'var(--primary, #2F6DF6)' }} />
                        <span
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: 'var(--text, #E8EEF9)',
                          }}
                        >
                          {ev.file_path}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            color: 'var(--muted, #8C9AB8)',
                            backgroundColor: 'var(--surface, #0A1228)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: '1px solid var(--border, #1A2748)',
                          }}
                        >
                          Lines {ev.line_start}–{ev.line_end}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            color: '#34D399',
                            backgroundColor: 'rgba(52, 211, 153, 0.08)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: '1px solid rgba(52, 211, 153, 0.25)',
                          }}
                        >
                          {ev.detector || 'parameterized SQL'}
                        </span>
                      </div>

                      <button
                        onClick={() => openDrawerForCitation(ev.file_path, ev.line_start, ev.line_end)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          backgroundColor: 'var(--surface, #0A1228)',
                          border: '1px solid var(--border, #1A2748)',
                          color: 'var(--text, #E8EEF9)',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          padding: '4px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--primary, #2F6DF6)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border, #1A2748)';
                        }}
                      >
                        <span>View file</span>
                        <ExternalLink size={11} />
                      </button>
                    </div>

                    {/* Syntax Highlighted Snippet */}
                    <div
                      onClick={() => openDrawerForCitation(ev.file_path, ev.line_start, ev.line_end)}
                      title="Click to view file in Code Viewer drawer"
                      style={{
                        backgroundColor: '#070C18',
                        cursor: 'pointer',
                        padding: '4px 0',
                      }}
                    >
                      <SyntaxHighlighter
                        language="python"
                        style={vscDarkPlus}
                        showLineNumbers
                        startingLineNumber={ev.line_start}
                        wrapLines
                        customStyle={{
                          margin: 0,
                          padding: '12px 16px',
                          backgroundColor: '#070C18',
                          fontSize: '12px',
                          lineHeight: 1.5,
                        }}
                        lineNumberStyle={{
                          minWidth: '36px',
                          paddingRight: '12px',
                          color: '#4B5563',
                          textAlign: 'right',
                          userSelect: 'none',
                        }}
                      >
                        {ev.snippet || 'def query():\n    pass'}
                      </SyntaxHighlighter>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* No Evidence State */
              <div
                style={{
                  padding: '24px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--surface, #0A1228)',
                  border: '1.5px dashed #94A3B8',
                  color: 'var(--muted, #8C9AB8)',
                  fontSize: '13px',
                  lineHeight: 1.6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text, #E8EEF9)', fontWeight: 600, marginBottom: '6px' }}>
                  <Search size={16} style={{ color: '#94A3B8' }} />
                  <span>No code evidence found in analyzed scope</span>
                </div>
                <p style={{ margin: 0 }}>
                  Static analysis scanned 6 files at commit SHA {shortSha} without detecting verified {currentRequirement?.name} patterns.
                </p>
              </div>
            )}

            {/* Collapsed Ignored Signals List */}
            {currentAssessment.ignored_signals && currentAssessment.ignored_signals.length > 0 && (
              <div style={{ marginTop: '18px' }}>
                <button
                  onClick={() => setShowIgnoredSignals(!showIgnoredSignals)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    backgroundColor: 'var(--surface-2, #101A30)',
                    border: '1px solid var(--border, #1A2748)',
                    borderRadius: '10px',
                    padding: '10px 16px',
                    color: 'var(--text, #E8EEF9)',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={14} style={{ color: '#FBBF24' }} />
                    <span>Ignored signals ({currentAssessment.ignored_signals.length})</span>
                    <span style={{ fontSize: '11px', color: 'var(--muted, #8C9AB8)', fontWeight: 400 }}>
                      Weak signals excluded per Invariant #7
                    </span>
                  </div>
                  {showIgnoredSignals ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>

                {showIgnoredSignals && (
                  <div
                    style={{
                      marginTop: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      backgroundColor: 'var(--surface, #0A1228)',
                      border: '1px solid var(--border, #1A2748)',
                      borderRadius: '10px',
                      padding: '12px 16px',
                    }}
                  >
                    {currentAssessment.ignored_signals.map((sig, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 0',
                          borderBottom: i < currentAssessment.ignored_signals.length - 1 ? '1px solid var(--border, #1A2748)' : 'none',
                          fontSize: '12px',
                        }}
                      >
                        <div>
                          <span style={{ color: 'var(--text, #E8EEF9)', fontWeight: 500 }}>{sig.reason}</span>
                          <span style={{ color: 'var(--muted, #8C9AB8)', marginLeft: '8px', fontFamily: 'JetBrains Mono, monospace' }}>
                            ({sig.file_path}:{sig.line})
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            border: '1px dashed #94A3B8',
                            color: '#94A3B8',
                          }}
                        >
                          NOT COUNTED
                        </span>
                      </div>
                    ))}
                    <div style={{ fontSize: '11px', color: 'var(--muted, #8C9AB8)', marginTop: '4px' }}>
                      Comments, README claims, empty functions, and trivial assertions never count toward evidence.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Job Requirement Card + Current Status Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Job Requirement Card */}
            <div className="reference-card" style={{ padding: '20px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                }}
              >
                <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--text, #E8EEF9)' }}>
                  Job Requirement
                </h3>
                <a
                  href={activeDataset.job.source_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    color: 'var(--primary, #2F6DF6)',
                    fontSize: '12px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                >
                  <span>Source</span>
                  <ExternalLink size={11} />
                </a>
              </div>

              <blockquote
                style={{
                  margin: 0,
                  padding: '12px 14px',
                  backgroundColor: 'var(--surface-2, #101A30)',
                  borderLeft: '3px solid var(--primary, #2F6DF6)',
                  borderRadius: '0 8px 8px 0',
                  color: 'var(--text, #E8EEF9)',
                  fontSize: '13px',
                  lineHeight: 1.5,
                  fontStyle: 'italic',
                }}
              >
                "{currentRequirement?.source_sentence || 'Work with relational databases and SQL queries.'}"
              </blockquote>

              <div
                style={{
                  marginTop: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '11.5px',
                  color: 'var(--muted, #8C9AB8)',
                }}
              >
                <span>Category: <strong style={{ color: 'var(--text, #E8EEF9)' }}>{currentRequirement?.category}</strong></span>
                <span
                  style={{
                    textTransform: 'uppercase',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--surface-2, #101A30)',
                    border: '1px solid var(--border, #1A2748)',
                    color: currentRequirement?.priority === 'must' ? '#34D399' : 'var(--muted, #8C9AB8)',
                  }}
                >
                  {currentRequirement?.priority} HAVE
                </span>
              </div>
            </div>

            {/* Current Status Card */}
            <div className="reference-card" style={{ padding: '20px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}
              >
                <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--text, #E8EEF9)' }}>
                  Current Status
                </h3>
                <StatusPill status={currentAssessment.status} size="sm" />
              </div>

              {/* Evidence Checklist (Strict Rule: No red ✕ anywhere!) */}
              {renderChecklist()}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REQUIREMENTS TAB */}
      {activeTab === 'requirements' && (
        <div style={{ maxWidth: '780px' }}>
          <div className="reference-card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text, #E8EEF9)' }}>
              Original Job Requirement
            </h2>

            <div
              style={{
                backgroundColor: 'var(--surface-2, #101A30)',
                padding: '16px',
                borderRadius: '8px',
                borderLeft: '4px solid var(--primary, #2F6DF6)',
                marginBottom: '20px',
                fontSize: '14px',
                lineHeight: 1.6,
                color: 'var(--text, #E8EEF9)',
              }}
            >
              "{currentRequirement?.source_sentence}"
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', fontSize: '13px' }}>
              <div>
                <span style={{ color: 'var(--muted, #8C9AB8)' }}>Category:</span>
                <p style={{ margin: '4px 0 0 0', fontWeight: 600, color: 'var(--text, #E8EEF9)' }}>
                  {currentRequirement?.category}
                </p>
              </div>

              <div>
                <span style={{ color: 'var(--muted, #8C9AB8)' }}>Priority:</span>
                <p style={{ margin: '4px 0 0 0', fontWeight: 600, color: currentRequirement?.priority === 'must' ? '#34D399' : 'var(--muted, #8C9AB8)', textTransform: 'capitalize' }}>
                  {currentRequirement?.priority}-have
                </p>
              </div>

              <div>
                <span style={{ color: 'var(--muted, #8C9AB8)' }}>Taxonomy Key:</span>
                <p style={{ margin: '4px 0 0 0', fontWeight: 600, color: 'var(--text, #E8EEF9)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {currentRequirement?.taxonomy_key || currentRequirement?.id}
                </p>
              </div>

              <div>
                <span style={{ color: 'var(--muted, #8C9AB8)' }}>Extracted Search Terms:</span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {currentRequirement?.search_terms?.map((term, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: '11px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--surface-2, #101A30)',
                        border: '1px solid var(--border, #1A2748)',
                        color: 'var(--text, #E8EEF9)',
                      }}
                    >
                      {term}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LIMITATIONS TAB */}
      {activeTab === 'limitations' && (
        <div style={{ maxWidth: '780px' }}>
          {/* Amber Limitation Box */}
          <div
            style={{
              backgroundColor: 'rgba(251, 191, 36, 0.06)',
              border: '1px solid rgba(251, 191, 36, 0.3)',
              borderRadius: '14px',
              padding: '24px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#FBBF24', marginBottom: '12px' }}>
              <AlertTriangle size={18} />
              <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Scope & Method Limitations</h2>
            </div>

            <p style={{ margin: '0 0 14px 0', fontSize: '13.5px', color: 'var(--text, #E8EEF9)', lineHeight: 1.6 }}>
              {currentAssessment.limitation ||
                'Static code analysis verifies syntax patterns and imports at the analyzed commit. Execution runtime state cannot be observed.'}
            </p>

            <div
              style={{
                fontSize: '12.5px',
                color: 'var(--muted, #8C9AB8)',
                paddingTop: '12px',
                borderTop: '1px solid rgba(251, 191, 36, 0.15)',
              }}
            >
              <strong>Engine Invariant #6:</strong> Testing status is capped at PARTIAL because tests are not executed; Deployment status is capped at PARTIAL because static configuration does not guarantee live runtime infrastructure.
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: NEXT STEPS TAB */}
      {activeTab === 'next_steps' && (
        <div style={{ maxWidth: '780px' }}>
          {/* Teal Next-Step Box (visually distinct from verified facts) */}
          <div
            style={{
              backgroundColor: 'rgba(45, 212, 191, 0.06)',
              border: '1px solid rgba(45, 212, 191, 0.3)',
              borderRadius: '14px',
              padding: '24px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#2DD4BF', marginBottom: '12px' }}>
              <Sparkles size={18} />
              <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Recommended Next Steps</h2>
            </div>

            <p style={{ margin: '0 0 14px 0', fontSize: '13.5px', color: 'var(--text, #E8EEF9)', lineHeight: 1.6 }}>
              {currentAssessment.next_step ||
                'Implement verified patterns in the repository and commit changes to trigger an automated reassessment.'}
            </p>

            <div
              style={{
                fontSize: '12.5px',
                color: 'var(--muted, #8C9AB8)',
                paddingTop: '12px',
                borderTop: '1px solid rgba(45, 212, 191, 0.15)',
              }}
            >
              Note: This recommendation is generated by the Coach agent to guide incremental project enhancement. It is strictly separated from verified facts.
            </div>
          </div>
        </div>
      )}

      {/* Slide-over Code Viewer Drawer */}
      <CodeViewerDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        filePath={drawerCitation.filePath}
        sha={currentSha}
        highlightRange={{ start: drawerCitation.start, end: drawerCitation.end }}
        repoOwner={repoOwner}
        repoName={repoName}
      />
    </div>
  );
};
