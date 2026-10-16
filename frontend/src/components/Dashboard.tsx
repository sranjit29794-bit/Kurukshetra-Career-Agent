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
  TrendingUp,
  Briefcase,
  GitBranch,
  CheckCircle2,
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

interface DashboardProps {
  opportunities: TrackOpportunity[];
  recentChanges: RecentChange[];
  nextActions: NextAction[];
  onAddJob: () => void;
  onSelectTrack: (trackId: string) => void;
  onNavigateActivity?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  opportunities,
  recentChanges,
  nextActions,
  onAddJob,
  onSelectTrack,
  onNavigateActivity,
}) => {
  // State toggles for testing loading, empty, and error states
  const [viewState, setViewState] = useState<'normal' | 'loading' | 'empty' | 'error'>('normal');

  const activeOpportunity = opportunities[0];

  // Default demo skills matching reference.png
  const referenceSkills = [
    {
      name: 'Python',
      status: 'DEMONSTRATED' as const,
      location: 'Found in app/main.py (lines 12-48)',
      changeType: 'files' as const,
      changeCount: 2,
    },
    {
      name: 'FastAPI',
      status: 'DEMONSTRATED' as const,
      location: 'Found in api/routes.py (lines 5-42)',
      changeType: 'no_change' as const,
    },
    {
      name: 'SQL',
      status: 'PARTIAL' as const,
      location: 'Found in db/models.py (lines 10-32)',
      changeType: 'files' as const,
      changeCount: 1,
    },
    {
      name: 'Testing',
      status: 'DEMONSTRATED' as const,
      location: 'Found in tests/test_api.py (lines 8-26)',
      changeType: 'files' as const,
      changeCount: 3,
    },
    {
      name: 'Deployment',
      status: 'NOT_DEMONSTRATED' as const,
      location: 'No evidence found in analyzed scope',
      changeType: 'no_change' as const,
    },
    {
      name: 'Git & GitHub',
      status: 'DEMONSTRATED' as const,
      location: 'Found in .github/workflows/ (lines 1-20)',
      changeType: 'no_change' as const,
    },
  ];

  // If there are real opportunity assessments, map them; otherwise use reference set
  const skillsToDisplay =
    activeOpportunity?.job?.requirements?.map((req) => {
      const asmt = activeOpportunity.assessments.find((a) => a.requirement_id === req.id);
      const ev = asmt?.evidence?.[0];
      const location = ev
        ? `Found in ${ev.file_path} (lines ${ev.line_start}-${ev.line_end})`
        : asmt?.status === 'NOT_DEMONSTRATED'
        ? 'No evidence found in analyzed scope'
        : 'Assessed from repository';
      return {
        name: req.name,
        status: asmt?.status || ('NOT_DEMONSTRATED' as const),
        location,
        changeType: (asmt?.reassessed ? 'files' : 'no_change') as 'files' | 'no_change',
        changeCount: asmt?.reassessed ? 1 : undefined,
      };
    }) || referenceSkills;

  // Compute status summary counts
  const demonstratedCount = skillsToDisplay.filter((s) => s.status === 'DEMONSTRATED').length;
  const partialCount = skillsToDisplay.filter((s) => s.status === 'PARTIAL').length;
  const notDemCount = skillsToDisplay.filter((s) => s.status === 'NOT_DEMONSTRATED').length;
  const totalCount = skillsToDisplay.length;

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '32px 28px' }}>
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

        {/* State Switcher & Add Job CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
      {viewState === 'empty' ? (
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
              value={viewState === 'loading' ? 'Loading job...' : activeOpportunity?.job?.title || 'Software Developer Intern'}
              subLine={
                activeOpportunity?.job?.company
                  ? `${activeOpportunity.job.company} · Posted 3 days ago`
                  : 'Google · Posted 3 days ago'
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
                  : `${activeOpportunity?.repo?.owner || 'rohan-dev'}/${activeOpportunity?.repo?.name || 'portfolio'}`
              }
              subLine="Last commit: 2 hours ago"
              actionText="View Repo >"
              onAction={() => activeOpportunity && onSelectTrack(activeOpportunity.id)}
            />

            {/* Card 3: Last Assessment */}
            <StatCard
              icon={<CheckCircle2 size={20} />}
              iconBg="linear-gradient(135deg, rgba(52, 211, 153, 0.25) 0%, rgba(16, 149, 106, 0.45) 100%)"
              iconColor="#34D399"
              label="Last Assessment"
              value={viewState === 'loading' ? 'Assessing...' : activeOpportunity?.last_assessed_at || '2 hours ago'}
              subLine="4 skills updated"
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
                {skillsToDisplay.map((skill, idx) => (
                  <div
                    key={skill.name || idx}
                    onClick={() => activeOpportunity && onSelectTrack(activeOpportunity.id)}
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
                        width: '90px',
                        flexShrink: 0,
                      }}
                    >
                      {skill.name}
                    </span>

                    {/* Status Pill */}
                    <div style={{ width: '150px', flexShrink: 0 }}>
                      <StatusPill status={skill.status} size="sm" />
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
                ))}
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
                    agent="Code Analyzer"
                    message="Parsed 12 files for skill matching"
                    timestamp="2m ago"
                  />
                  <AgentRow
                    agent="Evidence Collector"
                    message="Found 3 new evidence snippets"
                    timestamp="3m ago"
                  />
                  <AgentRow
                    agent="Verifier"
                    message="Validated 3 citations"
                    timestamp="4m ago"
                  />
                  <AgentRow
                    agent="Impact Analyzer"
                    message="Detected 2 changed skills"
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
            {/* Recent Changes Box */}
            <div className="reference-card" style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <TrendingUp size={16} style={{ color: 'var(--primary, #2F6DF6)' }} />
                <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: 'var(--text, #E8EEF9)' }}>
                  Recent Repository Changes (Push Detected)
                </h3>
              </div>

              {recentChanges.map((change) => (
                <div
                  key={change.id}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text, #E8EEF9)' }}>
                        {change.commit_message}
                      </span>
                      <div style={{ color: 'var(--muted, #8C9AB8)', fontSize: '12px', marginTop: '2px' }}>
                        by {change.author} • {change.timestamp}
                      </div>
                    </div>
                    <ShaChip sha={change.commit_sha} size="sm" />
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {change.transitions.map((t, idx) => (
                      <div
                        key={idx}
                        style={{
                          fontSize: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor:
                            t.change === 'improved' ? 'rgba(52, 211, 153, 0.12)' : 'var(--surface-2, #101A30)',
                          border: `1px solid ${
                            t.change === 'improved' ? 'rgba(52, 211, 153, 0.3)' : 'var(--border, #1A2748)'
                          }`,
                          color: t.change === 'improved' ? '#34D399' : 'var(--muted, #8C9AB8)',
                          fontWeight: t.change === 'improved' ? 600 : 500,
                        }}
                      >
                        <span>{t.skill}:</span>
                        <span>
                          {t.before === 'NOT_DEMONSTRATED' ? '○' : '◐'} → {t.after === 'DEMONSTRATED' ? '✓' : '◐'}
                        </span>
                        {t.change === 'improved' && <span>(Improved)</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

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
    </div>
  );
};
