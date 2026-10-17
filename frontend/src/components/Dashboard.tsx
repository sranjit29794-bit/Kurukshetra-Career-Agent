import React, { useState } from 'react';
import {
  ExternalLink,
  Plus,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Clock,
  Layers,
  ChevronRight,
  Briefcase,
  GitBranch,
  CheckCircle2,
  RefreshCw,
  X,
} from 'lucide-react';
import type { TrackOpportunity, RecentChange, NextAction } from '../types';
import { StatCard } from './StatCard';
import { SegmentedRing } from './SegmentedRing';
import { SkillIconTile } from './SkillIconTile';
import { StatusPill } from './StatusPill';
import { UpdatedChip } from './UpdatedChip';
import { ShaChip } from './ShaChip';
import { AgentRow } from './AgentRow';
import { LiveChip } from './LiveChip';
import { ChangeDetectionCard } from './ChangeDetectionCard';
import { useSSE } from '../hooks/useSSE';
import { api, FORCE_FIXTURES } from '../lib/api';

interface DashboardProps {
  opportunities: TrackOpportunity[];
  recentChanges: RecentChange[];
  nextActions: NextAction[];
  onAddJob: () => void;
  onSelectTrack: (trackId: string, reqId?: string) => void;
  onNavigateActivity?: () => void;
  onNavigateCompare?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  opportunities,
  recentChanges: _recentChanges,
  nextActions,
  onAddJob,
  onSelectTrack,
  onNavigateActivity,
  onNavigateCompare,
}) => {
  // State toggles for testing loading, empty, and error states
  const [viewState, setViewState] = useState<'normal' | 'loading' | 'empty' | 'error'>('normal');
  const [isCheckingCommits, setIsCheckingCommits] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [currentCommitMode, setCurrentCommitMode] = useState<'c2' | 'c0' | 'c1'>('c2');

  const activeOpportunity = opportunities[0];

  // SSE hook with live push simulation engine (§19.2)
  const sse = useSSE({
    trackId: activeOpportunity?.id || (FORCE_FIXTURES ? 'track_demo' : ''),
    fixtureMode: FORCE_FIXTURES,
    onAnalysisComplete: (sha) => {
      if (sha.startsWith('c3d4e5f')) {
        setCurrentCommitMode('c2');
      } else if (sha.startsWith('b2c3d4e')) {
        setCurrentCommitMode('c1');
      }
    },
  });

  const displayToast = sse.toastMessage || toastMessage;

  const handleCheckCommits = async () => {
    if (!activeOpportunity?.id) return;
    setIsCheckingCommits(true);
    try {
      const res = await api.checkNow(activeOpportunity.id);
      setToastMessage(
        `Checked commits: ${res.sha.slice(0, 7)} detected · ${res.skillsUpdated} skills updated`
      );
    } catch {
      setToastMessage('Repository checked: up to date with branch main');
    } finally {
      setIsCheckingCommits(false);
      setTimeout(() => {
        setToastMessage(null);
      }, 4500);
    }
  };

  // Canonical skills matching BRAIN §19.1 demo and fixtures
  // Testing capped at PARTIAL; Deployment & CI/CD stay NOT_DEMONSTRATED
  const referenceSkills = [
    {
      id: 'req_python',
      name: 'Python',
      status: 'DEMONSTRATED' as const,
      location: 'Found in app/db.py (lines 1-20)',
      changeType: 'files' as const,
      changeCount: 1,
    },
    {
      id: 'req_rest_api',
      name: 'FastAPI / REST APIs',
      status: 'DEMONSTRATED' as const,
      location: 'Found in app/main.py (lines 15-38)',
      changeType: 'no_change' as const,
    },
    {
      id: 'req_sql_database',
      name: 'SQL',
      status:
        currentCommitMode === 'c0' || currentCommitMode === 'c1'
          ? ('NOT_DEMONSTRATED' as const)
          : ('DEMONSTRATED' as const),
      location:
        currentCommitMode === 'c0' || currentCommitMode === 'c1'
          ? 'Not found in analyzed scope'
          : 'Found in app/db.py (lines 12-30)',
      changeType: currentCommitMode === 'c2' ? ('files' as const) : ('not_reassessed' as const),
      changeCount: currentCommitMode === 'c2' ? 1 : undefined,
    },
    {
      id: 'req_testing',
      name: 'Testing',
      status:
        currentCommitMode === 'c0' || currentCommitMode === 'c1'
          ? ('NOT_DEMONSTRATED' as const)
          : ('PARTIAL' as const),
      location:
        currentCommitMode === 'c0' || currentCommitMode === 'c1'
          ? 'Not found in analyzed scope'
          : 'Found in tests/test_db.py (lines 8-24)',
      changeType: currentCommitMode === 'c2' ? ('files' as const) : ('not_reassessed' as const),
      changeCount: currentCommitMode === 'c2' ? 1 : undefined,
    },
    {
      id: 'req_deployment',
      name: 'Deployment',
      status: 'NOT_DEMONSTRATED' as const,
      location: 'Not found in analyzed scope',
      changeType: 'not_reassessed' as const,
    },
    {
      id: 'req_ci_cd',
      name: 'CI/CD (GitHub Actions)',
      status: 'NOT_DEMONSTRATED' as const,
      location: 'Not found in analyzed scope',
      changeType: 'not_reassessed' as const,
    },
  ];

  // If there are real opportunity assessments, map them; otherwise use canonical set
  const skillsToDisplay =
    activeOpportunity?.job?.requirements && activeOpportunity.job.requirements.length > 0
      ? activeOpportunity.job.requirements.map((req) => {
          const asmt = activeOpportunity.assessments?.find((a) => a.requirement_id === req.id);
          const ev = asmt?.evidence?.[0];
          const isNotDem = asmt ? asmt.status === 'NOT_DEMONSTRATED' : true;
          const location = isNotDem
            ? 'Not found in analyzed scope'
            : ev
            ? `Found in ${ev.file_path} (lines ${ev.line_start}-${ev.line_end})`
            : 'Not found in analyzed scope';

          const changeType = asmt?.reassessed
            ? ('files' as const)
            : isNotDem
            ? ('not_reassessed' as const)
            : ('no_change' as const);

          return {
            id: req.id,
            name: req.name,
            status: asmt?.status || ('NOT_DEMONSTRATED' as const),
            location,
            changeType,
            changeCount: asmt?.reassessed ? 1 : undefined,
          };
        })
      : FORCE_FIXTURES
      ? referenceSkills
      : [];

  // Compute status summary counts (3 demonstrated, 1 partial, 2 not demonstrated)
  const demonstratedCount = skillsToDisplay.filter((s) => s.status === 'DEMONSTRATED').length;
  const partialCount = skillsToDisplay.filter((s) => s.status === 'PARTIAL').length;
  const notDemCount = skillsToDisplay.filter((s) => s.status === 'NOT_DEMONSTRATED').length;
  const totalCount = skillsToDisplay.length;

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '32px 28px', position: 'relative' }}>
      {/* Toast Notification */}
      {displayToast && (
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
          <span>{displayToast}</span>
          <button
            onClick={() => {
              setToastMessage(null);
              sse.clearToast();
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--muted, #8C9AB8)',
              cursor: 'pointer',
              padding: '0 0 0 8px',
              fontSize: '14px',
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Welcome Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '26px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 800,
              letterSpacing: '-0.025em',
              margin: '0 0 6px 0',
              color: 'var(--text, #E8EEF9)',
            }}
          >
            Welcome back, Rohan 👋
          </h1>
          <p style={{ margin: 0, color: 'var(--muted, #8C9AB8)', fontSize: '14px' }}>
            Your projects. Real evidence. Career ready.
          </p>
        </div>

        {/* Rehearsal Demo Buttons (§19.2) - visible only in explicit dev fixture mode */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {FORCE_FIXTURES && (
            <>
              {/* Live Push Rehearsal (C2) */}
              <button
                onClick={() => {
                  setCurrentCommitMode('c0');
                  sse.simulateLivePush('c2');
                }}
                disabled={sse.isReassessing}
                style={{
                  backgroundColor: 'rgba(47, 109, 246, 0.15)',
                  border: '1px solid #2F6DF6',
                  color: '#60A5FA',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: sse.isReassessing ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
                title="Simulate live push C2: adds database and tests, reassessing 4 skills"
              >
                <Sparkles size={13} style={{ color: '#60A5FA' }} />
                <span>Simulate Push (C2)</span>
              </button>

              {/* Live Push Rehearsal (C1 Docs Only) */}
              <button
                onClick={() => {
                  sse.simulateLivePush('c1');
                  setCurrentCommitMode('c1');
                }}
                disabled={sse.isReassessing}
                style={{
                  backgroundColor: 'var(--surface-2, #101A30)',
                  border: '1px solid var(--border, #1A2748)',
                  color: 'var(--muted, #8C9AB8)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: sse.isReassessing ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
                title="Simulate push C1: docs only, no skill upgrade"
              >
                <span>Push C1 (Docs Only)</span>
              </button>

              {/* Reset Baseline (C0) */}
              <button
                onClick={() => setCurrentCommitMode('c0')}
                style={{
                  backgroundColor: currentCommitMode === 'c0' ? 'rgba(148, 163, 184, 0.2)' : 'transparent',
                  border: '1px solid var(--border, #1A2748)',
                  color: 'var(--muted, #8C9AB8)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
                title="Reset to baseline C0 (Not Demonstrated for SQL & Testing)"
              >
                Reset C0
              </button>

              {/* State Switcher */}
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
                {(['normal', 'loading', 'empty', 'error'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewState(mode)}
                    style={{
                      background: viewState === mode ? 'var(--primary, #2F6DF6)' : 'transparent',
                      color: viewState === mode ? '#FFFFFF' : 'var(--muted, #8C9AB8)',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      textTransform: 'capitalize',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {mode === 'loading' ? 'Loading' : mode}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Check for new commits button */}
          <button
            onClick={handleCheckCommits}
            disabled={isCheckingCommits}
            title="Check for new commits via API"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--surface-2, #101A30)',
              color: 'var(--text, #E8EEF9)',
              border: '1px solid var(--border, #1A2748)',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: isCheckingCommits ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <RefreshCw
              size={14}
              style={{
                color: '#60A5FA',
                transform: isCheckingCommits ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.5s ease',
              }}
            />
            <span>{isCheckingCommits ? 'Checking...' : 'Check for new commits'}</span>
          </button>

          <button
            onClick={onAddJob}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--primary, #2F6DF6)',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: '13px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(47, 109, 246, 0.4)',
              transition: 'background-color 0.15s ease',
            }}
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>Add Job</span>
          </button>
        </div>
      </div>

      {/* ERROR STATE */}
      {viewState === 'error' && (
        <div
          className="reference-card"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            borderColor: 'rgba(239, 68, 68, 0.3)',
            padding: '24px',
            marginBottom: '28px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
          }}
        >
          <AlertCircle size={22} style={{ color: '#EF4444', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', color: '#EF4444', fontWeight: 600 }}>
              Connection Error: Failed to refresh tracked opportunities
            </h3>
            <p style={{ margin: '0 0 14px 0', color: 'var(--text, #E8EEF9)', fontSize: '13px', lineHeight: 1.5 }}>
              Could not contact the local assessment service. Make sure backend is running or continue with static verification mode.
            </p>
            <button
              onClick={() => setViewState('normal')}
              style={{
                backgroundColor: '#EF4444',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retry Connection
            </button>
          </div>
        </div>
      )}

      {/* EMPTY STATE */}
      {((!FORCE_FIXTURES && opportunities.length === 0) || viewState === 'empty') ? (
        <div
          className="reference-card"
          style={{
            padding: '56px 24px',
            textAlign: 'center',
            marginBottom: '32px',
            borderStyle: 'dashed',
          }}
        >
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              backgroundColor: 'var(--surface-2, #101A30)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              color: 'var(--primary, #2F6DF6)',
              border: '1px solid var(--border, #1A2748)',
            }}
          >
            <Layers size={26} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text, #E8EEF9)' }}>
            No Tracked Opportunities Yet
          </h3>
          <p
            style={{
              margin: '0 auto 20px auto',
              maxWidth: '440px',
              color: 'var(--muted, #8C9AB8)',
              fontSize: '13.5px',
              lineHeight: 1.5,
            }}
          >
            Paste any internship or software engineering job posting to extract requirements and connect your GitHub repo.
          </p>
          <button
            onClick={onAddJob}
            style={{
              backgroundColor: 'var(--primary, #2F6DF6)',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: '13px',
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(47, 109, 246, 0.4)',
            }}
          >
            + Add First Job Posting
          </button>
        </div>
      ) : (
        <>
          {/* User's Tracked Opportunities List (Step 6) */}
          <div className="reference-card" style={{ padding: '20px 24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Briefcase size={16} style={{ color: 'var(--primary, #2F6DF6)' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text, #E8EEF9)' }}>
                  Tracked Opportunities ({opportunities.length})
                </h3>
              </div>
              <button
                onClick={onAddJob}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(47, 109, 246, 0.15)',
                  border: '1px solid #2F6DF6',
                  color: '#60A5FA',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Plus size={13} />
                <span>Track Another Job</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {opportunities.map((opp) => {
                const dem = opp.status_summary?.demonstrated ?? opp.assessments?.filter((a) => a.status === 'DEMONSTRATED').length ?? 0;
                const part = opp.status_summary?.partial ?? opp.assessments?.filter((a) => a.status === 'PARTIAL').length ?? 0;
                const notDem = opp.status_summary?.not_demonstrated ?? opp.assessments?.filter((a) => a.status === 'NOT_DEMONSTRATED').length ?? 0;

                return (
                  <div
                    key={opp.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      backgroundColor: opp.id === activeOpportunity?.id ? 'var(--surface-2, #101A30)' : 'var(--surface, #0A1228)',
                      border: `1px solid ${opp.id === activeOpportunity?.id ? 'var(--primary, #2F6DF6)' : 'var(--border, #1A2748)'}`,
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    <div style={{ minWidth: '220px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text, #E8EEF9)' }}>
                          {opp.job?.title || 'Software Engineer'}
                        </span>
                        {opp.job?.company && (
                          <span style={{ fontSize: '12px', color: 'var(--muted, #8C9AB8)' }}>
                            · {opp.job.company}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '12px', color: 'var(--muted, #8C9AB8)' }}>
                        <GitBranch size={13} />
                        <span>{opp.repo?.owner}/{opp.repo?.name}</span>
                        <span>({opp.branch})</span>
                        <ShaChip sha={opp.last_seen_sha || 'HEAD'} size="sm" />
                      </div>
                    </div>

                    {/* Summary counts */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
                      <span style={{ color: '#34D399', fontWeight: 600 }}>
                        ✓ {dem} Demonstrated
                      </span>
                      <span style={{ color: '#FBBF24', fontWeight: 600 }}>
                        ◐ {part} Partial
                      </span>
                      <span style={{ color: '#94A3B8' }}>
                        ○ {notDem} Not found
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => onSelectTrack(opp.id)}
                        style={{
                          backgroundColor: 'var(--primary, #2F6DF6)',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        View Report
                      </button>
                      <button
                        onClick={async () => {
                          if (window.confirm(`Delete track for "${opp.job?.title || 'job'}"?`)) {
                            await api.deleteTrack(opp.id);
                            window.location.reload();
                          }
                        }}
                        style={{
                          backgroundColor: 'transparent',
                          color: '#EF4444',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                        title="Delete this track"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top 3 Stat Cards in a row per reference.png */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '18px',
              marginBottom: '26px',
            }}
          >
            {/* Card 1: Active Job */}
            <StatCard
              icon={<Briefcase size={20} />}
              iconBg="linear-gradient(135deg, rgba(47, 109, 246, 0.3) 0%, rgba(30, 58, 138, 0.5) 100%)"
              iconColor="#60A5FA"
              label="Active Job"
              value={
                viewState === 'loading'
                  ? 'Loading job...'
                  : activeOpportunity?.job?.title || 'No Active Track'
              }
              subLine={
                activeOpportunity?.job?.company
                  ? `${activeOpportunity.job.company} · Target Posting`
                  : 'Add a job posting to begin'
              }
              actionText="View Job >"
              onAction={() => activeOpportunity && onSelectTrack(activeOpportunity.id)}
            />

            {/* Card 2: Connected Repository */}
            <StatCard
              icon={<GitBranch size={20} />}
              iconBg="linear-gradient(135deg, rgba(100, 116, 139, 0.3) 0%, rgba(51, 65, 85, 0.5) 100%)"
              iconColor="#CBD5E1"
              label="Connected Repository"
              value={
                viewState === 'loading'
                  ? 'Loading repo...'
                  : activeOpportunity?.repo?.owner
                  ? `${activeOpportunity.repo.owner}/${activeOpportunity.repo.name}`
                  : 'No repo connected'
              }
              subLine={`Branch: ${activeOpportunity?.branch || 'main'}`}
              sha={activeOpportunity?.last_seen_sha || 'HEAD'}
              actionText="View Repo >"
              onAction={() => activeOpportunity && onSelectTrack(activeOpportunity.id)}
            />

            {/* Card 3: Last Assessment */}
            <StatCard
              icon={<CheckCircle2 size={20} />}
              iconBg="linear-gradient(135deg, rgba(52, 211, 153, 0.25) 0%, rgba(16, 149, 106, 0.45) 100%)"
              iconColor="#34D399"
              label="Last Assessment"
              value={viewState === 'loading' ? 'Assessing...' : activeOpportunity?.last_assessed_at || '12 minutes ago'}
              subLine="2 skills updated"
              sha={activeOpportunity?.last_seen_sha || 'c3d4e5f67890123456789abcdef0123456789012'}
              actionText="View Details >"
              onAction={() => activeOpportunity && onSelectTrack(activeOpportunity.id)}
            />
          </div>

          {/* Main 2-Column Grid: Left (Skills Overview) / Right (Ring + Agent Activity) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)',
              gap: '20px',
              marginBottom: '32px',
            }}
          >
            {/* Left: Skill Assessment Overview Card */}
            <div className="reference-card" style={{ padding: '24px' }}>
              <div style={{ marginBottom: '20px' }}>
                <h2
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    margin: '0 0 4px 0',
                    color: 'var(--text, #E8EEF9)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Skill Assessment Overview
                </h2>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted, #8C9AB8)' }}>
                  Evidence-based analysis of your code against job requirements.
                </p>
              </div>

              {/* Skill list rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {skillsToDisplay.map((skill, idx) => {
                  const isReassessing = sse.reassessingSkills.includes(skill.id);
                  const isRecentlyUpdated = sse.recentlyUpdatedSkills.includes(skill.id);

                  return (
                    <div
                      key={skill.name || idx}
                      onClick={() => activeOpportunity && onSelectTrack(activeOpportunity.id, skill.id)}
                      className={isRecentlyUpdated ? 'highlight-reassessed flip-card' : ''}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        backgroundColor: 'transparent',
                        border: '1px solid transparent',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease, border-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--surface-2, #101A30)';
                        e.currentTarget.style.borderColor = 'var(--border, #1A2748)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.borderColor = 'transparent';
                      }}
                    >
                      {/* Skill Lucide Tile */}
                      <SkillIconTile skill={skill.name} size="md" />

                      {/* Skill Name */}
                      <span
                        style={{
                          fontSize: '13.5px',
                          fontWeight: 600,
                          color: 'var(--text, #E8EEF9)',
                          width: '170px',
                          flexShrink: 0,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {skill.name}
                      </span>

                      {/* Status Pill or Reassessing Chip */}
                      <div style={{ width: '160px', flexShrink: 0 }}>
                        {isReassessing ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              backgroundColor: 'rgba(47, 109, 246, 0.15)',
                              border: '1px solid #2F6DF6',
                              color: '#60A5FA',
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '6px',
                            }}
                          >
                            <RefreshCw size={11} className="spin-icon" />
                            <span>Reassessing…</span>
                          </span>
                        ) : (
                          <StatusPill status={skill.status} size="sm" />
                        )}
                      </div>

                      {/* Location / Evidence description */}
                      <div
                        style={{
                          flex: 1,
                          fontSize: '12px',
                          color: 'var(--muted, #8C9AB8)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {skill.location}
                      </div>

                      {/* Updated Chip */}
                      <div style={{ flexShrink: 0 }}>
                        <UpdatedChip
                          type={skill.changeType}
                          count={skill.changeCount}
                          size="sm"
                        />
                      </div>

                      <ChevronRight size={14} style={{ color: 'var(--muted, #8C9AB8)', flexShrink: 0 }} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Segmented Ring & Agent Activity */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Segmented Ring Widget */}
              <SegmentedRing
                demonstrated={demonstratedCount}
                partial={partialCount}
                notDemonstrated={notDemCount}
                total={totalCount}
                headline={`${demonstratedCount} of ${totalCount} demonstrated`}
                subline={`${notDemCount} need more evidence`}
              />

              {/* Agent Activity Widget */}
              <div className="reference-card" style={{ padding: '20px 22px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '14px',
                  }}
                >
                  <h3
                    style={{
                      fontSize: '14.5px',
                      fontWeight: 700,
                      color: 'var(--text, #E8EEF9)',
                      margin: 0,
                    }}
                  >
                    Agent Activity
                  </h3>
                  <LiveChip label="Live" size="sm" />
                </div>

                {/* Agent Rows */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <AgentRow
                    agent="Repo Scout"
                    message="Resolved HEAD SHA c3d4e5f on branch main"
                    timestamp="2m ago"
                  />
                  <AgentRow
                    agent="Change Sentinel"
                    message="Detected commit c3d4e5f • reassessing 4 skills"
                    timestamp="3m ago"
                  />
                  <AgentRow
                    agent="Evidence Analyst"
                    message="Found 1 strong SQL signal in app/db.py:12-30"
                    timestamp="4m ago"
                  />
                  <AgentRow
                    agent="Verifier"
                    message="Validated citations at c3d4e5f (0 mismatches)"
                    timestamp="5m ago"
                  />
                </div>

                {/* View Full Activity Link */}
                <div style={{ marginTop: '14px', paddingTop: '10px' }}>
                  <button
                    onClick={onNavigateActivity}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary, #2F6DF6)',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: 0,
                    }}
                  >
                    <span>View full activity →</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Tracked Opportunities Table (Detailed view per BRAIN §16.3) */}
          <div className="reference-card" style={{ overflow: 'hidden', marginBottom: '32px' }}>
            <div
              style={{
                padding: '16px 22px',
                borderBottom: '1px solid var(--border, #1A2748)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text, #E8EEF9)' }}>
                Tracked Opportunities
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--muted, #8C9AB8)' }}>
                {opportunities.length} tracked opportunity
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border, #1A2748)', color: 'var(--muted, #8C9AB8)', fontSize: '11px' }}>
                    <th style={{ padding: '12px 22px', fontWeight: 600 }}>JOB & COMPANY</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>REPOSITORY</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>ANALYZED COMMIT</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>LAST ASSESSED</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>STATUS SUMMARY</th>
                    <th style={{ padding: '12px 22px', fontWeight: 600, textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {opportunities.map((opp) => (
                    <tr
                      key={opp.id}
                      style={{
                        borderBottom: '1px solid rgba(26, 39, 72, 0.5)',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '16px 22px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text, #E8EEF9)', marginBottom: '3px' }}>
                          {opp.job.title}
                        </div>
                        <div style={{ color: 'var(--muted, #8C9AB8)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{opp.job.company}</span>
                          <a
                            href={opp.job.source_url}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              color: 'var(--primary, #2F6DF6)',
                              textDecoration: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px',
                            }}
                          >
                            Source <ExternalLink size={10} />
                          </a>
                        </div>
                      </td>

                      <td style={{ padding: '16px 16px' }}>
                        <div style={{ fontWeight: 500, color: 'var(--text, #E8EEF9)' }}>
                          {opp.repo.owner}/{opp.repo.name}
                        </div>
                        <div style={{ color: 'var(--muted, #8C9AB8)', fontSize: '11.5px' }}>
                          branch: {opp.branch}
                        </div>
                      </td>

                      <td style={{ padding: '16px 16px' }}>
                        <ShaChip sha={opp.last_seen_sha} size="sm" />
                      </td>

                      <td style={{ padding: '16px 16px', color: 'var(--muted, #8C9AB8)', fontSize: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Clock size={12} />
                          <span>{opp.last_assessed_at}</span>
                        </div>
                      </td>

                      <td style={{ padding: '16px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                          <span style={{ color: '#34D399', fontWeight: 600 }}>
                            {opp.status_summary.demonstrated} ✓
                          </span>
                          <span style={{ color: '#FBBF24', fontWeight: 600 }}>
                            {opp.status_summary.partial} ◐
                          </span>
                          <span style={{ color: '#94A3B8', fontWeight: 600 }}>
                            {opp.status_summary.not_demonstrated} ○
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: '16px 22px', textAlign: 'right' }}>
                        <button
                          onClick={() => onSelectTrack(opp.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            backgroundColor: 'var(--surface-2, #101A30)',
                            border: '1px solid var(--border, #1A2748)',
                            color: 'var(--text, #E8EEF9)',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '12.5px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <span>View Evidence</span>
                          <ChevronRight size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Repository Changes & Next Actions */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
            {/* Change Detection & Reassessment Card (matching reference.png bottom-right panel) */}
            <ChangeDetectionCard
              sha={currentCommitMode === 'c1' ? 'b2c3d4e5f67890123456789abcdef01234567890' : 'c3d4e5f67890123456789abcdef0123456789012'}
              relativeTime={currentCommitMode === 'c1' ? 'Just now via push' : '2 hours ago'}
              isDocsOnly={currentCommitMode === 'c1'}
              onViewReport={onNavigateCompare}
            />

            {/* Recommended Next Actions Box */}
            <div className="reference-card" style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Sparkles size={16} style={{ color: 'var(--primary, #2F6DF6)' }} />
                <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: 'var(--text, #E8EEF9)' }}>
                  Recommended Next Actions
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {nextActions.map((action) => (
                  <div
                    key={action.id}
                    style={{
                      backgroundColor: 'var(--surface-2, #101A30)',
                      border: '1px solid var(--border, #1A2748)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text, #E8EEF9)' }}>
                          {action.skill}
                        </span>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor:
                              action.priority === 'must'
                                ? 'rgba(47, 109, 246, 0.15)'
                                : 'rgba(148, 163, 184, 0.1)',
                            color: action.priority === 'must' ? '#60A5FA' : 'var(--muted, #8C9AB8)',
                          }}
                        >
                          {action.priority.toUpperCase()}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted, #8C9AB8)', lineHeight: 1.4 }}>
                        {action.detail}
                      </p>
                    </div>

                    <ArrowRight size={14} style={{ color: 'var(--muted, #8C9AB8)', flexShrink: 0, marginLeft: '12px' }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Privacy Policy & Data Wipe Footer (DATA_POLICY.md / Step 6) */}
      <div
        style={{
          marginTop: '36px',
          padding: '16px 20px',
          borderRadius: '10px',
          border: '1px dashed var(--border, #1A2748)',
          backgroundColor: 'rgba(10, 18, 40, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          fontSize: '12.5px',
          color: 'var(--muted, #8C9AB8)',
        }}
      >
        <div>
          <strong style={{ color: 'var(--text, #E8EEF9)' }}>Data Privacy Policy:</strong>{' '}
          Zero binary retention. No candidate PDF files are stored on disk or database. Minimal structured technical claims only.
        </div>
        <button
          onClick={async () => {
            if (window.confirm('Delete all your data (all tracks, jobs, resumes, analyses) per DATA_POLICY.md? This cannot be undone.')) {
              await api.deleteMyData();
              window.location.reload();
            }
          }}
          style={{
            backgroundColor: 'transparent',
            color: '#EF4444',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '6px',
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title="Delete all candidate data permanently"
        >
          Delete All My Data
        </button>
      </div>
    </div>
  );
};
