import React, { useState } from 'react';
import {
  ExternalLink,
  Plus,
  GitCommit,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Clock,
  Radio,
  Layers,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import type { TrackOpportunity, RecentChange, NextAction } from '../types';

interface DashboardProps {
  opportunities: TrackOpportunity[];
  recentChanges: RecentChange[];
  nextActions: NextAction[];
  onAddJob: () => void;
  onSelectTrack: (trackId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  opportunities,
  recentChanges,
  nextActions,
  onAddJob,
  onSelectTrack,
}) => {
  // State toggles for testing loading, empty, and error states
  const [viewState, setViewState] = useState<'normal' | 'loading' | 'empty' | 'error'>('normal');

  // Compute plain counts (STRICT INVARIANT: No readiness percentage anywhere)
  const totalTracked = viewState === 'empty' ? 0 : opportunities.length;
  const totalRequirements = viewState === 'empty' ? 0 : opportunities.reduce(
    (acc, opp) =>
      acc +
      opp.status_summary.demonstrated +
      opp.status_summary.partial +
      opp.status_summary.not_demonstrated +
      opp.status_summary.unable,
    0
  );
  const totalStrongEvidence = viewState === 'empty' ? 0 : opportunities.reduce(
    (acc, opp) => acc + opp.status_summary.demonstrated,
    0
  );
  const totalNeedEvidence = viewState === 'empty' ? 0 : opportunities.reduce(
    (acc, opp) => acc + opp.status_summary.partial + opp.status_summary.not_demonstrated,
    0
  );

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Top Header & Primary CTA */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '28px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              margin: '0 0 6px 0',
              color: 'var(--text)',
            }}
          >
            Evidence Overview
          </h1>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px' }}>
            Continuously updated assessment tracking code proof against real job posting requirements.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Debug / Fixture state switcher for judges / testing */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--surface-2)',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              padding: '2px',
              fontSize: '11px',
            }}
          >
            <button
              onClick={() => setViewState('normal')}
              style={{
                background: viewState === 'normal' ? 'var(--surface)' : 'transparent',
                color: viewState === 'normal' ? 'var(--text)' : 'var(--muted)',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Normal
            </button>
            <button
              onClick={() => setViewState('loading')}
              style={{
                background: viewState === 'loading' ? 'var(--surface)' : 'transparent',
                color: viewState === 'loading' ? 'var(--text)' : 'var(--muted)',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Skeleton Loading
            </button>
            <button
              onClick={() => setViewState('empty')}
              style={{
                background: viewState === 'empty' ? 'var(--surface)' : 'transparent',
                color: viewState === 'empty' ? 'var(--text)' : 'var(--muted)',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Empty
            </button>
            <button
              onClick={() => setViewState('error')}
              style={{
                background: viewState === 'error' ? 'var(--surface)' : 'transparent',
                color: viewState === 'error' ? 'var(--text)' : 'var(--muted)',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Error
            </button>
          </div>

          <button
            onClick={onAddJob}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--accent)',
              color: '#000',
              fontWeight: 700,
              fontSize: '13.5px',
              padding: '9px 18px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 0 16px rgba(45, 212, 191, 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Add Job</span>
          </button>
        </div>
      </div>

      {/* ================================================================== */}
      {/* ERROR STATE */}
      {/* ================================================================== */}
      {viewState === 'error' && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius)',
            padding: '24px',
            marginBottom: '28px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
          }}
        >
          <AlertCircle size={22} style={{ color: '#EF4444', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#EF4444' }}>
              Connection Error: Failed to refresh tracked opportunities
            </h3>
            <p style={{ margin: '0 0 14px 0', color: 'var(--text)', fontSize: '13px', lineHeight: 1.5 }}>
              Could not reach the DevProof API or GitHub rate limit exceeded. Existing assessments are preserved at their commit SHAs.
            </p>
            <button
              onClick={() => setViewState('normal')}
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontSize: '12px',
                fontWeight: 600,
                padding: '6px 14px',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Retry Connection
            </button>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* STATS TILES: Plain-Count Stats ONLY (No readiness % per BRAIN §16.3) */}
      {/* ================================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        {/* Tile 1 */}
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '20px',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '8px' }}>
            TRACKED OPPORTUNITIES
          </span>
          {viewState === 'loading' ? (
            <div style={{ height: '32px', width: '60px', backgroundColor: 'var(--surface-2)', borderRadius: '4px' }} />
          ) : (
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text)' }}>
              {totalTracked}
            </div>
          )}
          <span style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
            Active paired repositories
          </span>
        </div>

        {/* Tile 2 */}
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '20px',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '8px' }}>
            REQUIREMENTS ASSESSED
          </span>
          {viewState === 'loading' ? (
            <div style={{ height: '32px', width: '60px', backgroundColor: 'var(--surface-2)', borderRadius: '4px' }} />
          ) : (
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text)' }}>
              {totalRequirements}
            </div>
          )}
          <span style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
            Extracted skill benchmarks
          </span>
        </div>

        {/* Tile 3 */}
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '20px',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--status-demonstrated)', display: 'block', marginBottom: '8px' }}>
            WITH STRONG EVIDENCE
          </span>
          {viewState === 'loading' ? (
            <div style={{ height: '32px', width: '60px', backgroundColor: 'var(--surface-2)', borderRadius: '4px' }} />
          ) : (
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--status-demonstrated)' }}>
              {totalStrongEvidence}
            </div>
          )}
          <span style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
            Verified in analyzed code
          </span>
        </div>

        {/* Tile 4 */}
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '20px',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--status-partial)', display: 'block', marginBottom: '8px' }}>
            NEED MORE EVIDENCE
          </span>
          {viewState === 'loading' ? (
            <div style={{ height: '32px', width: '60px', backgroundColor: 'var(--surface-2)', borderRadius: '4px' }} />
          ) : (
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--status-partial)' }}>
              {totalNeedEvidence}
            </div>
          )}
          <span style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
            Partial or unverified in scope
          </span>
        </div>
      </div>

      {/* ================================================================== */}
      {/* EMPTY STATE */}
      {/* ================================================================== */}
      {viewState === 'empty' ? (
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius)',
            padding: '48px 24px',
            textAlign: 'center',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'var(--surface-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              color: 'var(--accent)',
            }}
          >
            <Layers size={24} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px 0' }}>
            No Tracked Opportunities Yet
          </h3>
          <p style={{ margin: '0 auto 20px auto', maxWidth: '440px', color: 'var(--muted)', fontSize: '13.5px', lineHeight: 1.5 }}>
            Paste any public internship or software engineering job posting to extract requirements and connect your GitHub repo.
          </p>
          <button
            onClick={onAddJob}
            style={{
              backgroundColor: 'var(--accent)',
              color: '#000',
              fontWeight: 700,
              fontSize: '13px',
              padding: '10px 20px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            + Add First Job Posting
          </button>
        </div>
      ) : (
        <>
          {/* ================================================================ */}
          {/* TRACKED OPPORTUNITIES TABLE per BRAIN §16.3 */}
          {/* ================================================================ */}
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              overflow: 'hidden',
              marginBottom: '32px',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>
                Tracked Opportunities
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                {opportunities.length} tracked opportunity
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontSize: '11.5px' }}>
                    <th style={{ padding: '12px 20px', fontWeight: 600 }}>JOB & COMPANY</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>REPOSITORY</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>ANALYZED COMMIT</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>LAST ASSESSED</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>EVIDENCE SUMMARY</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>WATCHER</th>
                    <th style={{ padding: '12px 20px', fontWeight: 600, textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {viewState === 'loading'
                    ? [1, 2].map((i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td colSpan={7} style={{ padding: '20px' }}>
                            <div style={{ height: '24px', backgroundColor: 'var(--surface-2)', borderRadius: '4px' }} />
                          </td>
                        </tr>
                      ))
                    : opportunities.map((opp) => (
                        <tr
                          key={opp.id}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            transition: 'background-color 0.1s ease',
                          }}
                        >
                          {/* Job Title & Company */}
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '3px' }}>
                              {opp.job.title}
                            </div>
                            <div style={{ color: 'var(--muted)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{opp.job.company}</span>
                              <a
                                href={opp.job.source_url}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  color: 'var(--accent)',
                                  textDecoration: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                }}
                              >
                                Source <ExternalLink size={11} />
                              </a>
                            </div>
                          </td>

                          {/* Repo */}
                          <td style={{ padding: '16px 16px' }}>
                            <div style={{ fontWeight: 500 }}>
                              {opp.repo.owner}/{opp.repo.name}
                            </div>
                            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                              branch: {opp.branch}
                            </div>
                          </td>

                          {/* Commit Chip */}
                          <td style={{ padding: '16px 16px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                backgroundColor: 'var(--surface-2)',
                                border: '1px solid var(--border)',
                                fontFamily: 'JetBrains Mono',
                                fontSize: '12px',
                                color: 'var(--accent)',
                              }}
                            >
                              <GitCommit size={12} />
                              {opp.last_seen_sha.substring(0, 7)}
                            </span>
                          </td>

                          {/* Last Assessed */}
                          <td style={{ padding: '16px 16px', color: 'var(--muted)', fontSize: '12.5px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Clock size={12} />
                              <span>{opp.last_assessed_at}</span>
                            </div>
                          </td>

                          {/* Status Mini-Summary */}
                          <td style={{ padding: '16px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                              <span style={{ color: 'var(--status-demonstrated)', fontWeight: 600 }}>
                                {opp.status_summary.demonstrated} ✓
                              </span>
                              <span style={{ color: 'var(--status-partial)', fontWeight: 600 }}>
                                {opp.status_summary.partial} ◐
                              </span>
                              <span style={{ color: 'var(--status-not-demonstrated)', fontWeight: 600 }}>
                                {opp.status_summary.not_demonstrated} ○
                              </span>
                            </div>
                          </td>

                          {/* Watcher State */}
                          <td style={{ padding: '16px 16px' }}>
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '11.5px',
                                color: 'var(--muted)',
                              }}
                            >
                              <Radio size={12} style={{ color: 'var(--accent)' }} />
                              <span>{opp.watcher_mode === 'webhook' ? 'Webhook' : 'Polling'}</span>
                            </div>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                            <button
                              onClick={() => onSelectTrack(opp.id)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                backgroundColor: 'var(--surface-2)',
                                border: '1px solid var(--border)',
                                color: 'var(--text)',
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

          {/* ================================================================ */}
          {/* RECENT REPOSITORY CHANGES & NEXT ACTIONS (2-COLUMN GRID) */}
          {/* ================================================================ */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
            {/* Recent Changes Box */}
            <div
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <TrendingUp size={16} style={{ color: 'var(--accent)' }} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
                  Recent Repository Changes (Push Detected)
                </h3>
              </div>

              {recentChanges.map((change) => (
                <div
                  key={change.id}
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text)' }}>
                        {change.commit_message}
                      </span>
                      <div style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '2px' }}>
                        by {change.author} • {change.timestamp}
                      </div>
                    </div>
                    <span
                      style={{
                        fontFamily: 'JetBrains Mono',
                        fontSize: '11px',
                        backgroundColor: 'var(--surface)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        color: 'var(--accent)',
                      }}
                    >
                      {change.commit_sha.substring(0, 7)}
                    </span>
                  </div>

                  {/* Status transitions pill list */}
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
                            t.change === 'improved'
                              ? 'rgba(45, 212, 191, 0.1)'
                              : 'var(--surface)',
                          border: `1px solid ${
                            t.change === 'improved' ? 'var(--accent)' : 'var(--border)'
                          }`,
                          color: t.change === 'improved' ? 'var(--accent)' : 'var(--muted)',
                          fontWeight: t.change === 'improved' ? 600 : 500,
                        }}
                      >
                        <span>{t.skill}:</span>
                        <span>{t.before === 'NOT_DEMONSTRATED' ? '○' : '◐'} → {t.after === 'DEMONSTRATED' ? '✓' : '◐'}</span>
                        {t.change === 'improved' && <span>(Improved)</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Recommended Next Actions Box */}
            <div
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Sparkles size={16} style={{ color: 'var(--accent)' }} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
                  Recommended Next Actions
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {nextActions.map((action) => (
                  <div
                    key={action.id}
                    style={{
                      backgroundColor: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>
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
                                ? 'rgba(45, 212, 191, 0.15)'
                                : 'var(--surface)',
                            color: action.priority === 'must' ? 'var(--accent)' : 'var(--muted)',
                          }}
                        >
                          {action.priority.toUpperCase()}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.4 }}>
                        {action.detail}
                      </p>
                    </div>

                    <ArrowRight size={14} style={{ color: 'var(--muted)', flexShrink: 0, marginLeft: '12px' }} />
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
