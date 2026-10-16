import React, { useEffect, useState } from 'react';
import type { DiffResponse } from '../types/contract';
import { API_BASE } from '../api/config';

interface DiffViewProps {
  trackId: number;
  onNavigate: (route: string) => void;
}

export const DiffView: React.FC<DiffViewProps> = ({ trackId, onNavigate }) => {
  const [diff, setDiff] = useState<DiffResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/tracks/${trackId}/diff`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch diff comparison');
        return res.json();
      })
      .then((data) => setDiff(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [trackId]);

  if (loading) {
    return (
      <div style={{ maxWidth: '1100px', margin: '40px auto', padding: '0 24px', color: 'var(--text-muted)' }}>
        Computing before-and-after assessment diff...
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1160px', margin: '0 auto', padding: '36px 24px' }}>
      {/* Breadcrumb Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <span onClick={() => onNavigate('/')} style={{ color: 'var(--accent-cyan)', cursor: 'pointer', fontWeight: 600 }}>
            Console
          </span>
          <span style={{ color: 'var(--text-dim)' }}>/</span>
          <span onClick={() => onNavigate(`/tracks/${trackId}`)} style={{ color: 'var(--accent-cyan)', cursor: 'pointer', fontWeight: 600 }}>
            Track #{trackId}
          </span>
          <span style={{ color: 'var(--text-dim)' }}>/</span>
          <span style={{ color: 'var(--text-muted)' }}>Diff Engine</span>
        </div>

        <button
          onClick={() => onNavigate(`/tracks/${trackId}`)}
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-card)',
            color: 'var(--text-main)',
            padding: '6px 14px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          ← Return to Track
        </button>
      </div>

      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-emerald)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
          Targeted Reassessment
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 8px 0', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-main)' }}>
          Before & After Evaluation Diff
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0, maxWidth: '720px', lineHeight: '1.6' }}>
          DevProof tracks real Git pushes. When code changes, the diff engine maps modified paths to affected skills, reassesses them, and carries forward unaffected evidence immutably.
        </p>
      </div>

      {error || !diff ? (
        <div
          style={{
            padding: '50px 24px',
            textAlign: 'center',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--border-card)',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📊</div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
            No Consecutive Analyses to Diff
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '460px', margin: '0 auto 20px auto', lineHeight: '1.6' }}>
            At least two distinct evaluations at different commit SHAs are required to compute a diff. Push new code or trigger a reassessment on a new commit.
          </p>
          <button
            onClick={() => onNavigate(`/tracks/${trackId}`)}
            style={{
              backgroundColor: 'var(--accent-cyan)',
              color: '#080c14',
              border: 'none',
              padding: '10px 20px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 700,
              fontSize: '13px',
            }}
          >
            Go to Track Detail →
          </button>
        </div>
      ) : (
        <div>
          {/* Commit Delta Header */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              marginBottom: '28px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 700 }}>
                  Previous SHA
                </div>
                <code style={{ fontSize: '14px', color: 'var(--text-muted)', backgroundColor: 'var(--bg-surface-elevated)', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>
                  {diff.from_sha ? diff.from_sha.slice(0, 8) : 'Initial'}
                </code>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 700 }}>
                  New Advanced SHA
                </div>
                <code style={{ fontSize: '14px', color: 'var(--accent-emerald)', backgroundColor: 'var(--bg-surface-elevated)', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>
                  {diff.to_sha.slice(0, 8)}
                </code>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 700 }}>
                  Files Modified
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>
                  {diff.files_changed.length} files
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 700 }}>
                  Reassessed vs Carried
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                  {diff.reassessed_count} reassessed / {diff.carried_forward_count} carried
                </div>
              </div>
            </div>

            {diff.commit_message && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', fontSize: '13px', color: 'var(--text-muted)' }}>
                <strong>Commit Message:</strong> <span style={{ color: 'var(--text-main)' }}>{diff.commit_message}</span>
              </div>
            )}
          </div>

          {/* Changed Files Strip */}
          {diff.files_changed.length > 0 && (
            <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', padding: '16px 20px', marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>
                Changed File Paths
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {diff.files_changed.map((f, fIdx) => (
                  <code
                    key={fIdx}
                    style={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                      color: 'var(--accent-cyan)',
                    }}
                  >
                    {f}
                  </code>
                ))}
              </div>
            </div>
          )}

          {/* Requirement Deltas Table */}
          <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 16px 0' }}>
              Skill Requirement Progression
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {diff.items.map((item, idx) => {
                const isImproved = item.change === 'improved';
                const isRegressed = item.change === 'regressed';
                const isNewlyAssessed = item.change === 'newly_assessed';

                return (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '16px 20px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main)' }}>
                          {item.name}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: isImproved
                              ? 'var(--accent-emerald-glow)'
                              : isRegressed
                              ? 'var(--accent-rose-glow)'
                              : isNewlyAssessed
                              ? 'var(--accent-cyan-glow)'
                              : 'var(--bg-surface)',
                            color: isImproved
                              ? 'var(--accent-emerald)'
                              : isRegressed
                              ? 'var(--accent-rose)'
                              : isNewlyAssessed
                              ? 'var(--accent-cyan)'
                              : 'var(--text-dim)',
                            border: `1px solid ${
                              isImproved
                                ? 'var(--accent-emerald)'
                                : isRegressed
                                ? 'var(--accent-rose)'
                                : isNewlyAssessed
                                ? 'var(--accent-cyan)'
                                : 'var(--border-subtle)'
                            }`,
                          }}
                        >
                          {item.change.toUpperCase()}
                        </span>
                      </div>

                      {/* Before -> After Status Chips */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                        <span style={{ color: 'var(--text-dim)' }}>
                          {item.before_status || 'NOT_ASSESSED'}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>➔</span>
                        <span style={{ fontWeight: 700, color: isImproved ? 'var(--accent-emerald)' : 'var(--text-main)' }}>
                          {item.after_status}
                        </span>
                      </div>
                    </div>

                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.5' }}>
                      {item.why}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
