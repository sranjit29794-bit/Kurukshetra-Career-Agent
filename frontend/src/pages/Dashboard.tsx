import React, { useEffect, useState } from 'react';
import type { TrackSummary, HealthResponse } from '../types/contract';
import { API_BASE } from '../api/config';

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
      fetch(`${API_BASE}/api/tracks`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}/api/health`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([tracksData, healthData]) => {
        setTracks(tracksData || []);
        setHealth(healthData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1240px', margin: '0 auto', padding: '40px 24px' }}>
      {/* Student Welcome Banner */}
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
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: 'var(--accent-primary)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                backgroundColor: 'var(--accent-primary-glow)',
                padding: '3px 10px',
                borderRadius: '12px',
              }}
            >
              STUDENT CAREER INTELLIGENCE
            </span>
            <span style={{ color: 'var(--text-dim)' }}>•</span>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Evidence Over Assumptions</span>
          </div>
          <h1
            style={{
              fontSize: '36px',
              fontWeight: 800,
              margin: '0 0 12px 0',
              fontFamily: 'var(--font-sans)',
              color: 'var(--text-main)',
              letterSpacing: '-0.03em',
              lineHeight: '1.25',
            }}
          >
            Bridge Your Code to Real Tech Roles
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '16px', margin: 0, maxWidth: '720px', lineHeight: '1.6' }}>
            DevProof maps real internship and entry-level job requirements directly against your GitHub repositories. No vague generic advice—just exact, verifiable proof of what your code already demonstrates and what to build next.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => onNavigate('/settings')}
            style={{
              backgroundColor: 'var(--bg-surface)',
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
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              border: 'none',
              padding: '12px 24px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 700,
              fontSize: '14px',
              boxShadow: 'var(--shadow-md)',
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

      {/* Interactive 3D Perspective Verification Pipeline */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px 32px',
          marginBottom: '36px',
          boxShadow: 'var(--shadow-sm)',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              HOW DEVPROOF EVALUATES YOUR CODE
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', margin: '4px 0 0 0' }}>
              The 4-Stage Evidence Pipeline
            </h2>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Select any stage to inspect how skills are verified without hallucination
          </div>
        </div>

        {/* 4 Interactive Stages */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
          }}
        >
          {[
            {
              id: 1,
              step: 'Step 1',
              title: 'Role Extraction',
              desc: 'Parses confirmed engineering requirements from any job posting URL or text.',
              tag: 'AST Skill Grammar',
              color: 'var(--accent-primary)',
            },
            {
              id: 2,
              step: 'Step 2',
              title: 'Repository Pinned SHA',
              desc: 'Inspects your public GitHub repo tree, bounding file scope and pinning exact commit SHA.',
              tag: 'Immutable Snapshot',
              color: 'var(--accent-cyan)',
            },
            {
              id: 3,
              step: 'Step 3',
              title: 'Skeptic Verifier',
              desc: 'Re-reads exact blob lines to independently confirm line ranges and syntax ASTs.',
              tag: 'Zero Hallucination',
              color: 'var(--accent-verified)',
            },
            {
              id: 4,
              step: 'Step 4',
              title: 'Automatic Push Sentinel',
              desc: 'Detects new commits automatically and triggers targeted diff reassessment.',
              tag: 'Live Sentinel',
              color: 'var(--accent-partial)',
            },
          ].map((s) => {
            const isSelected = activePipelineStep === s.id;
            return (
              <div
                key={s.id}
                onClick={() => setActivePipelineStep(s.id)}
                style={{
                  backgroundColor: isSelected ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                  border: isSelected ? `2px solid ${s.color}` : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '22px',
                  cursor: 'pointer',
                  transform: isSelected ? 'translateY(-2px)' : 'none',
                  boxShadow: isSelected ? 'var(--shadow-md)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: s.color, textTransform: 'uppercase' }}>
                    {s.step}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      backgroundColor: 'var(--bg-surface-subtle)',
                      border: '1px solid var(--border-subtle)',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                    }}
                  >
                    {s.tag}
                  </span>
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
                  {s.title}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.5' }}>
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
        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 700 }}>
            Watcher Engine
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-verified)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="live-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-verified)' }} />
            Polling Active (20s)
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Automatic SHA advancement watcher</div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 700 }}>
            Skeptic Verifier
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-primary)' }}>
            Deterministic AST (Active)
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Zero LLM hallucination in code proof</div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
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

        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 700 }}>
            History Integrity
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-verified)' }}>
            Immutable (Append-Only)
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Historical evaluations are strictly preserved</div>
        </div>
      </div>

      {/* Active Student Career Tracks */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Your Career Tracks
            </h2>
            <span
              style={{
                backgroundColor: 'var(--accent-primary-glow)',
                color: 'var(--accent-primary)',
                fontSize: '12px',
                fontWeight: 700,
                padding: '2px 10px',
                borderRadius: '12px',
              }}
            >
              {tracks.length} Saved
            </span>
          </div>

          <button
            onClick={() => onNavigate('/track')}
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-card)',
              color: 'var(--accent-primary)',
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              fontWeight: 700,
            }}
          >
            + Create New Track
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)' }}>
            Loading student career tracks...
          </div>
        ) : tracks.length === 0 ? (
          /* Student Onboarding Empty State */
          <div
            style={{
              padding: '60px 24px',
              textAlign: 'center',
              backgroundColor: 'var(--bg-surface)',
              border: '1px dashed var(--border-card)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <div style={{ fontSize: '40px', marginBottom: '14px' }}>🎓</div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
              Start Proving Your Skills
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '15px', maxWidth: '520px', margin: '0 auto 24px auto', lineHeight: '1.6' }}>
              Connect a real internship or junior developer job posting with your GitHub project. DevProof will find exact line citations for REST APIs, databases, automated tests, and deployment configurations.
            </p>
            <button
              onClick={() => onNavigate('/track')}
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
                border: 'none',
                padding: '12px 26px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                fontSize: '14px',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              Create Your First Track →
            </button>
          </div>
        ) : (
          /* Tracks Grid */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '22px' }}>
            {tracks.map((t) => (
              <div
                key={t.id}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 'var(--radius-md)',
                  padding: '24px',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s ease',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        backgroundColor: 'var(--bg-surface-elevated)',
                        color: 'var(--text-dim)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    >
                      TRACK #{t.id}
                    </span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: 'var(--accent-verified)',
                      }}
                    >
                      <span className="live-pulse" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-verified)' }} />
                      {t.watcher_mode || 'polling'}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 10px 0' }}>
                    Branch: <code style={{ color: 'var(--accent-primary)', backgroundColor: 'var(--bg-surface-elevated)', padding: '2px 6px', borderRadius: '4px' }}>{t.branch}</code>
                  </h3>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    <span>Pinned SHA:</span>
                    <code
                      style={{
                        backgroundColor: 'var(--bg-surface-elevated)',
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--accent-verified)',
                        fontSize: '12px',
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
                      backgroundColor: 'var(--accent-primary)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '10px 16px',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 700,
                      fontSize: '13px',
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
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 600,
                      fontSize: '13px',
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
