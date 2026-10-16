import React, { useEffect, useState } from 'react';
import type { TrackSummary, HealthResponse } from '../types/contract';

interface DashboardProps {
  onNavigate: (route: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePipelineStep, setActivePipelineStep] = useState<number>(1);

  useEffect(() => {
    Promise.all([
      fetch('http://localhost:8000/api/tracks').then((r) => (r.ok ? r.json() : [])),
      fetch('http://localhost:8000/api/health').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([tracksData, healthData]) => {
        setTracks(tracksData || []);
        setHealth(healthData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1240px', margin: '0 auto', padding: '36px 24px' }}>
      {/* Top Banner & Hero Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '36px',
          flexWrap: 'wrap',
          gap: '24px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-cyan)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Developer Intelligence Console
            </span>
            <span style={{ color: 'var(--text-dim)' }}>/</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Continuous Code Proof</span>
          </div>
          <h1
            style={{
              fontSize: '34px',
              fontWeight: 800,
              margin: '0 0 10px 0',
              fontFamily: 'JetBrains Mono, monospace',
              color: 'var(--text-main)',
              letterSpacing: '-0.03em',
            }}
          >
            Evidence-Backed Career Console
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px', margin: 0, maxWidth: '700px', lineHeight: '1.6' }}>
            <em>"Resumes claim. Repositories prove. DevProof keeps the proof current."</em> Evaluating real GitHub repository commits against verified job requirements.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => onNavigate('/settings')}
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-card)',
              color: 'var(--text-main)',
              padding: '12px 18px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>⚙️</span>
            <span>Integrations</span>
          </button>
          <button
            onClick={() => onNavigate('/track')}
            style={{
              backgroundColor: 'var(--accent-cyan)',
              color: '#080c14',
              border: 'none',
              padding: '12px 24px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 700,
              fontSize: '14px',
              boxShadow: 'var(--shadow-glow)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>+ Create Career Track</span>
            <span>→</span>
          </button>
        </div>
      </div>

      {/* Interactive 3D Perspective Pipeline Card */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px',
          marginBottom: '36px',
          boxShadow: 'var(--shadow-md)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Interactive Engine Architecture
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', margin: '4px 0 0 0' }}>
              The DevProof Verification Pipeline
            </h2>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
            Hover or click any stage to inspect how code evidence is validated
          </div>
        </div>

        {/* 4 Pipeline Stages */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
            position: 'relative',
          }}
        >
          {[
            {
              id: 1,
              step: 'Stage 01',
              title: 'Job Ingestion',
              desc: 'Extracts skill requirements from public URL or text with strict source attribution.',
              tag: 'AST Parser',
              color: 'var(--accent-cyan)',
            },
            {
              id: 2,
              step: 'Stage 02',
              title: 'Repository Pin',
              desc: 'Resolves candidate GitHub repo tree, bounding file scope and pinning exact commit SHA.',
              tag: 'Pinned SHA',
              color: 'var(--accent-emerald)',
            },
            {
              id: 3,
              step: 'Stage 03',
              title: 'Skeptic Verifier',
              desc: 'Re-reads exact blob lines to independently confirm cited code spans. Zero hallucination.',
              tag: 'Deterministic',
              color: 'var(--accent-violet)',
            },
            {
              id: 4,
              step: 'Stage 04',
              title: 'Push Sentinel',
              desc: 'Detects new commits via webhook/polling and triggers targeted diff reassessment.',
              tag: 'Live Sentinel',
              color: 'var(--accent-amber)',
            },
          ].map((s) => {
            const isSelected = activePipelineStep === s.id;
            return (
              <div
                key={s.id}
                onClick={() => setActivePipelineStep(s.id)}
                style={{
                  backgroundColor: isSelected ? 'var(--bg-surface-elevated)' : 'var(--bg-surface-card)',
                  border: isSelected ? `2px solid ${s.color}` : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '20px',
                  cursor: 'pointer',
                  transform: isSelected ? 'translateY(-2px)' : 'none',
                  boxShadow: isSelected ? 'var(--shadow-md)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: s.color, letterSpacing: '0.06em' }}>
                    {s.step}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                    }}
                  >
                    {s.tag}
                  </span>
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
                  {s.title}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.5' }}>
                  {s.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* System Health Status Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '36px',
        }}
      >
        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', padding: '18px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 700 }}>
            Watcher Engine
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="live-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-emerald)' }} />
            Polling Active (20s)
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Automatic SHA advancement watcher</div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', padding: '18px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 700 }}>
            Skeptic Verifier
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-cyan)' }}>
            Strict AST (Deterministic)
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Line bounds and blob content matching</div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', padding: '18px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 700 }}>
            GitHub API Quota
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: health?.github === 'rate_limited' ? 'var(--accent-rose)' : 'var(--text-main)' }}>
            {health?.github_rate_remaining !== null && health?.github_rate_remaining !== undefined
              ? `${health.github_rate_remaining} reqs remaining`
              : 'Public Tier (60/hr)'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {health?.github === 'rate_limited' ? 'Rate limited — see Settings' : 'File cache & tree optimization'}
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', padding: '18px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 700 }}>
            Track History Integrity
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-emerald)' }}>
            Immutable (Append-Only)
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Past analyses are never overwritten</div>
        </div>
      </div>

      {/* Persisted Career Tracks Section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Active Career Tracks
            </h2>
            <span
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                color: 'var(--accent-cyan)',
                border: '1px solid var(--border-subtle)',
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {tracks.length} Persisted
            </span>
          </div>

          <button
            onClick={() => onNavigate('/track')}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid var(--border-card)',
              color: 'var(--accent-cyan)',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            + New Track
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)' }}>
            Loading persisted tracks...
          </div>
        ) : tracks.length === 0 ? (
          /* Empty State */
          <div
            style={{
              padding: '50px 24px',
              textAlign: 'center',
              backgroundColor: 'var(--bg-surface)',
              border: '1px dashed var(--border-card)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎯</div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
              No Career Tracks Configured Yet
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '480px', margin: '0 auto 20px auto', lineHeight: '1.6' }}>
              DevProof connects a target job description with a candidate's GitHub repository to continually prove real coding competence.
            </p>
            <button
              onClick={() => onNavigate('/track')}
              style={{
                backgroundColor: 'var(--accent-cyan)',
                color: '#080c14',
                border: 'none',
                padding: '10px 22px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                fontSize: '14px',
              }}
            >
              Create Your First Track →
            </button>
          </div>
        ) : (
          /* Tracks Grid */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
            {tracks.map((t) => (
              <div
                key={t.id}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 'var(--radius-md)',
                  padding: '22px',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: 'var(--bg-surface-elevated)',
                        color: 'var(--text-dim)',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    >
                      TRACK #{t.id}
                    </span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--accent-emerald)',
                      }}
                    >
                      <span className="live-pulse" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-emerald)' }} />
                      {t.watcher_mode || 'polling'}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 8px 0' }}>
                    Branch: <code style={{ color: 'var(--accent-cyan)' }}>{t.branch}</code>
                  </h3>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    <span>Pinned SHA:</span>
                    <code
                      style={{
                        backgroundColor: 'var(--bg-surface-elevated)',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--accent-emerald)',
                        fontSize: '11px',
                      }}
                    >
                      {t.last_seen_sha ? t.last_seen_sha.slice(0, 8) : 'Not Pinned'}
                    </code>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                  <button
                    onClick={() => onNavigate(`/tracks/${t.id}`)}
                    style={{
                      flex: 1,
                      backgroundColor: 'var(--accent-cyan)',
                      color: '#080c14',
                      border: 'none',
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 700,
                      fontSize: '12px',
                    }}
                  >
                    Inspect Evidence →
                  </button>
                  <button
                    onClick={() => onNavigate(`/diff/${t.id}`)}
                    style={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-card)',
                      color: 'var(--text-main)',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 600,
                      fontSize: '12px',
                    }}
                    title="View Before & After Reassessment Diff"
                  >
                    Diff History
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
