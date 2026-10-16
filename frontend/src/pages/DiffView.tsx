import React, { useEffect, useState } from 'react';
import type { AnalysisDetail, DiffResponse } from '../types/contract';
import { API_BASE } from '../api/config';

interface DiffViewProps {
  trackId: number;
  onNavigate: (route: string) => void;
}

export const DiffView: React.FC<DiffViewProps> = ({ trackId, onNavigate }) => {
  const [diff, setDiff] = useState<DiffResponse | null>(null);
  const [history, setHistory] = useState<AnalysisDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Analysis comparison selectors
  const [fromAnalysisId, setFromAnalysisId] = useState<string>('');
  const [toAnalysisId, setToAnalysisId] = useState<string>('');
  const [diffComputing, setDiffComputing] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [diffRes, historyRes] = await Promise.all([
          fetch(`${API_BASE}/api/tracks/${trackId}/diff`),
          fetch(`${API_BASE}/api/tracks/${trackId}/history`),
        ]);

        if (isMounted && historyRes.ok) {
          const hist: AnalysisDetail[] = await historyRes.json();
          setHistory(hist);
          if (hist.length >= 2) {
            setFromAnalysisId(String(hist[1].id));
            setToAnalysisId(String(hist[0].id));
          }
        }

        if (diffRes.ok) {
          const data: DiffResponse = await diffRes.json();
          if (isMounted) setDiff(data);
        } else {
          const errData = await diffRes.json().catch(() => null);
          if (isMounted) setError(errData?.error?.message || 'Diff comparison unavailable');
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to load diff comparison');
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [trackId]);

  const handleCompareCustom = async () => {
    setDiffComputing(true);
    setError(null);
    try {
      let url = `${API_BASE}/api/tracks/${trackId}/diff`;
      const params = new URLSearchParams();
      if (fromAnalysisId) params.append('from_analysis_id', fromAnalysisId);
      if (toAnalysisId) params.append('to_analysis_id', toAnalysisId);
      const q = params.toString();
      if (q) url += `?${q}`;

      const res = await fetch(url);
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || 'Comparison failed');
      }
      const data: DiffResponse = await res.json();
      setDiff(data);
    } catch (err: any) {
      setError(err.message || 'Comparison failed');
    } finally {
      setDiffComputing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '1100px', margin: '40px auto', padding: '0 24px', color: 'var(--text-muted)' }}>
        Computing before-and-after assessment diff...
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1180px', margin: '0 auto', padding: '36px 24px' }}>
      {/* Breadcrumb Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <span onClick={() => onNavigate('/')} style={{ color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 600 }}>
            Console
          </span>
          <span style={{ color: 'var(--text-dim)' }}>/</span>
          <span onClick={() => onNavigate(`/tracks/${trackId}`)} style={{ color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 600 }}>
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
            padding: '8px 16px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          ← Return to Track #{trackId}
        </button>
      </div>

      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-verified)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
          Targeted Reassessment
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 8px 0', fontFamily: 'var(--font-sans)', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
          Before & After Evaluation Diff
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', margin: 0, maxWidth: '720px', lineHeight: '1.6' }}>
          DevProof tracks real Git pushes. When code changes, the diff engine maps modified paths to affected skills, reassesses them, and carries forward unaffected evidence immutably.
        </p>
      </div>

      {/* Arbitrary Run Comparison Selector */}
      {history.length >= 2 && (
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-card)',
            borderRadius: 'var(--radius-md)',
            padding: '18px 24px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                Base Evaluation (From)
              </label>
              <select
                value={fromAnalysisId}
                onChange={(e) => setFromAnalysisId(e.target.value)}
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-card)',
                  color: 'var(--text-main)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13px',
                }}
              >
                {history.map((h) => (
                  <option key={h.id} value={String(h.id)}>
                    Run #{h.id} - Commit {h.commit_sha.slice(0, 8)} ({new Date(h.started_at).toLocaleTimeString()})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ fontSize: '18px', color: 'var(--text-dim)', paddingTop: '16px' }}>➔</div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                Target Evaluation (To)
              </label>
              <select
                value={toAnalysisId}
                onChange={(e) => setToAnalysisId(e.target.value)}
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-card)',
                  color: 'var(--text-main)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13px',
                }}
              >
                {history.map((h) => (
                  <option key={h.id} value={String(h.id)}>
                    Run #{h.id} - Commit {h.commit_sha.slice(0, 8)} ({new Date(h.started_at).toLocaleTimeString()})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleCompareCustom}
            disabled={diffComputing || fromAnalysisId === toAnalysisId}
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              border: 'none',
              padding: '9px 18px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: fromAnalysisId === toAnalysisId ? 'not-allowed' : 'pointer',
              opacity: fromAnalysisId === toAnalysisId ? 0.6 : 1,
            }}
          >
            {diffComputing ? 'Computing Diff...' : 'Compare Selected Runs'}
          </button>
        </div>
      )}

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
            At least two distinct evaluations at different commit SHAs are required to compute a diff. Push new code or trigger a reassessment on an advanced commit.
          </p>
          <button
            onClick={() => onNavigate(`/tracks/${trackId}`)}
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
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
                <code style={{ fontSize: '14px', color: 'var(--accent-verified)', backgroundColor: 'var(--bg-surface-elevated)', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>
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
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-primary)' }}>
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
                      color: 'var(--accent-primary)',
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                              ? 'var(--accent-verified-bg)'
                              : isRegressed
                              ? 'rgba(225,29,72,0.1)'
                              : isNewlyAssessed
                              ? 'var(--accent-primary-glow)'
                              : 'var(--bg-surface)',
                            color: isImproved
                              ? 'var(--accent-verified)'
                              : isRegressed
                              ? 'var(--accent-rose)'
                              : isNewlyAssessed
                              ? 'var(--accent-primary)'
                              : 'var(--text-dim)',
                            border: `1px solid ${
                              isImproved
                                ? 'var(--accent-verified)'
                                : isRegressed
                                ? 'var(--accent-rose)'
                                : isNewlyAssessed
                                ? 'var(--accent-primary)'
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
                        <span style={{ fontWeight: 700, color: isImproved ? 'var(--accent-verified)' : 'var(--text-main)' }}>
                          {item.after_status}
                        </span>
                      </div>
                    </div>

                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 10px 0', lineHeight: '1.5' }}>
                      {item.why}
                    </p>

                    {/* Added Evidence Citations */}
                    {item.evidence_added && item.evidence_added.length > 0 && (
                      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-verified)', marginBottom: '6px' }}>
                          + NEW EVIDENCE DETECTED & VERIFIED AT COMMIT {diff.to_sha.slice(0, 8)}
                        </div>
                        {item.evidence_added.map((ev, evIdx) => (
                          <div
                            key={evIdx}
                            style={{
                              backgroundColor: 'var(--bg-app)',
                              padding: '8px 12px',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '12px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '6px',
                              overflowX: 'auto',
                            }}
                          >
                            <code>{ev.file_path}:{ev.line_start}-{ev.line_end}</code>
                            {ev.github_url && (
                              <a
                                href={ev.github_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: 'var(--accent-primary)', fontSize: '11px', fontWeight: 600 }}
                              >
                                Open at Commit ↗
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
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
