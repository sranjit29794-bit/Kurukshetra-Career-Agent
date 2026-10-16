import React, { useEffect, useState } from 'react';
import type {
  AnalysisDetail,
  ErrorResponse,
  TrackDetail,
} from '../types/contract';
import { API_BASE } from '../api/config';

interface TrackDetailViewProps {
  trackId: number;
  onNavigate: (route: string) => void;
}

export const TrackDetailView: React.FC<TrackDetailViewProps> = ({ trackId, onNavigate }) => {
  const [track, setTrack] = useState<TrackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Analysis / Assessment State
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [latestAnalysis, setLatestAnalysis] = useState<AnalysisDetail | null>(null);
  const [expandedEvidence, setExpandedEvidence] = useState<Record<number, boolean>>({});

  // Manual Check / Watcher State
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  // Filter Tab
  const [activeTab, setActiveTab] = useState<'all' | 'demonstrated' | 'partial' | 'not_demonstrated'>('all');

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [trackRes, historyRes] = await Promise.all([
          fetch(`${API_BASE}/api/tracks/${trackId}`),
          fetch(`${API_BASE}/api/tracks/${trackId}/history`),
        ]);

        if (!trackRes.ok) {
          throw new Error(`Track #${trackId} not found`);
        }

        const trackData: TrackDetail = await trackRes.json();
        if (!isMounted) return;
        setTrack(trackData);

        if (historyRes.ok) {
          const historyData: AnalysisDetail[] = await historyRes.json();
          if (historyData.length > 0 && isMounted) {
            setLatestAnalysis(historyData[0]);
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to load track data');
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [trackId]);

  const handleRunAssessment = async () => {
    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const res = await fetch(`${API_BASE}/api/tracks/${trackId}/analyze`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        const err = data as ErrorResponse;
        throw new Error(err.error?.message || 'Assessment analysis failed');
      }
      setLatestAnalysis(data as AnalysisDetail);
    } catch (err: any) {
      setAnalysisError(err.message || 'Analysis error');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const reloadTrackData = async () => {
    try {
      const [trackRes, historyRes] = await Promise.all([
        fetch(`${API_BASE}/api/tracks/${trackId}`),
        fetch(`${API_BASE}/api/tracks/${trackId}/history`),
      ]);
      if (trackRes.ok) {
        setTrack(await trackRes.json());
      }
      if (historyRes.ok) {
        const historyData: AnalysisDetail[] = await historyRes.json();
        if (historyData.length > 0) {
          setLatestAnalysis(historyData[0]);
        }
      }
    } catch {
      // Background reload failure ignored
    }
  };

  const handleManualCheck = async () => {
    setCheckLoading(true);
    setCheckMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/tracks/${trackId}/check`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.new_commit_detected) {
        setCheckMessage('✓ New commit detected! Targeted reassessment completed automatically.');
        reloadTrackData();
      } else {
        setCheckMessage(`Repository is up to date (HEAD is ${data.current_sha?.slice(0, 8)}).`);
      }
    } catch (err: any) {
      setCheckMessage('Watcher check failed: ' + (err.message || 'Network error'));
    } finally {
      setCheckLoading(false);
    }
  };

  const toggleEvidence = (assessmentId: number) => {
    setExpandedEvidence((prev) => ({
      ...prev,
      [assessmentId]: !prev[assessmentId],
    }));
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '1100px', margin: '40px auto', padding: '0 24px', color: 'var(--text-muted)' }}>
        Loading career track #{trackId}...
      </div>
    );
  }

  if (error || !track) {
    return (
      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '32px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--accent-rose)', borderRadius: 'var(--radius-md)' }}>
        <h2 style={{ color: 'var(--accent-rose)', margin: '0 0 12px 0' }}>Track Not Found</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>{error || 'Unable to locate track'}</p>
        <button
          onClick={() => onNavigate('/')}
          style={{
            backgroundColor: 'var(--accent-cyan)',
            color: '#080c14',
            border: 'none',
            padding: '10px 18px',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 700,
          }}
        >
          Return to Console
        </button>
      </div>
    );
  }

  const assessments = latestAnalysis?.assessments || [];
  const demonstratedCount = assessments.filter((a) => a.status === 'DEMONSTRATED').length;
  const partialCount = assessments.filter((a) => a.status === 'PARTIAL').length;
  const notDemonstratedCount = assessments.filter((a) => a.status === 'NOT_DEMONSTRATED').length;

  const filteredAssessments = assessments.filter((a) => {
    if (activeTab === 'demonstrated') return a.status === 'DEMONSTRATED';
    if (activeTab === 'partial') return a.status === 'PARTIAL';
    if (activeTab === 'not_demonstrated') return a.status === 'NOT_DEMONSTRATED' || a.status === 'UNABLE_TO_ASSESS';
    return true;
  });

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1160px', margin: '0 auto', padding: '36px 24px' }}>
      {/* Breadcrumb Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <span onClick={() => onNavigate('/')} style={{ color: 'var(--accent-cyan)', cursor: 'pointer', fontWeight: 600 }}>
            Console
          </span>
          <span style={{ color: 'var(--text-dim)' }}>/</span>
          <span style={{ color: 'var(--text-muted)' }}>Career Track #{trackId}</span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => onNavigate(`/diff/${trackId}`)}
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-card)',
              color: 'var(--text-main)',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>📊</span>
            <span>View Reassessment Diff</span>
          </button>
          <button
            onClick={() => onNavigate('/')}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid var(--border-card)',
              color: 'var(--text-muted)',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            ← Back to Console
          </button>
        </div>
      </div>

      {/* Track Profile Banner */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px',
          marginBottom: '28px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {track.job.company || 'Direct Job'}
              </span>
              <span style={{ color: 'var(--text-dim)' }}>•</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{track.job.source_type}</span>
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 10px 0', fontFamily: 'JetBrains Mono, monospace' }}>
              {track.job.title}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '13px', color: 'var(--text-muted)' }}>
              <div>
                Repository:{' '}
                <a
                  href={track.repo.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}
                >
                  {track.repo.owner}/{track.repo.name} ↗
                </a>
              </div>
              <div>
                Branch: <code style={{ color: 'var(--text-main)' }}>{track.branch}</code>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Pinned SHA:</span>
                <code style={{ backgroundColor: 'var(--bg-surface-elevated)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', color: 'var(--accent-emerald)', fontSize: '12px' }}>
                  {track.last_seen_sha ? track.last_seen_sha.slice(0, 8) : 'Pending'}
                </code>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '220px' }}>
            <button
              onClick={handleRunAssessment}
              disabled={analysisLoading}
              style={{
                backgroundColor: 'var(--accent-cyan)',
                color: '#080c14',
                border: 'none',
                padding: '12px 20px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                fontSize: '13px',
                boxShadow: 'var(--shadow-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {analysisLoading ? (
                <>
                  <span className="live-pulse">↻</span>
                  <span>Evaluating Code Evidence...</span>
                </>
              ) : (
                <>
                  <span>⚡</span>
                  <span>{latestAnalysis ? 'Re-run Assessment' : 'Run Deterministic Assessment'}</span>
                </>
              )}
            </button>

            <button
              onClick={handleManualCheck}
              disabled={checkLoading}
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-card)',
                color: 'var(--text-main)',
                padding: '10px 16px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              {checkLoading ? 'Checking GitHub...' : '🔍 Check for New Commits'}
            </button>
          </div>
        </div>

        {checkMessage && (
          <div
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderLeft: '4px solid var(--accent-cyan)',
              borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
              padding: '10px 14px',
              fontSize: '13px',
              color: 'var(--text-main)',
              marginTop: '14px',
            }}
          >
            {checkMessage}
          </div>
        )}

        {analysisError && (
          <div style={{ backgroundColor: 'var(--accent-rose-glow)', border: '1px solid var(--accent-rose)', borderRadius: 'var(--radius-sm)', padding: '12px', color: 'var(--accent-rose)', fontSize: '13px', marginTop: '14px' }}>
            <strong>Assessment Error:</strong> {analysisError}
          </div>
        )}
      </div>

      {/* Summary Scorecard Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', padding: '18px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 700 }}>
            Job Requirements
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)' }}>
            {track.job.requirements.length}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Confirmed scope</div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', padding: '18px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 700 }}>
            Demonstrated (Verified)
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-emerald)' }}>
            {demonstratedCount}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Strong code citations</div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', padding: '18px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 700 }}>
            Partial Evidence
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-amber)' }}>
            {partialCount}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Needs additional scope</div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', padding: '18px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 700 }}>
            Not Demonstrated
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-dim)' }}>
            {notDemonstratedCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Not found in inspected files</div>
        </div>
      </div>

      {/* Evidence Explorer & Requirements Section */}
      <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)', padding: '28px', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Evidence Intelligence Matrix
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Deterministic AST signals independently checked by the Skeptic Verifier
            </div>
          </div>

          {/* Filter Tabs */}
          <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--bg-surface-elevated)', padding: '4px', borderRadius: 'var(--radius-sm)' }}>
            {[
              { id: 'all', label: `All (${assessments.length})` },
              { id: 'demonstrated', label: `Demonstrated (${demonstratedCount})` },
              { id: 'partial', label: `Partial (${partialCount})` },
              { id: 'not_demonstrated', label: `Gaps (${notDemonstratedCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  backgroundColor: activeTab === tab.id ? 'var(--bg-surface)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {assessments.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ marginBottom: '16px' }}>No assessment runs recorded for this track yet.</p>
            <button
              onClick={handleRunAssessment}
              disabled={analysisLoading}
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
              Run First Code Assessment →
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {filteredAssessments.map((a, idx) => {
              const assessmentKey = a.id ?? a.requirement_id ?? idx;
              const isExpanded = !!expandedEvidence[assessmentKey];
              const isDemonstrated = a.status === 'DEMONSTRATED';
              const isPartial = a.status === 'PARTIAL';

              return (
                <div
                  key={assessmentKey}
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '20px',
                    transition: 'border-color 0.18s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '10px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: isDemonstrated
                              ? 'var(--accent-emerald-glow)'
                              : isPartial
                              ? 'var(--accent-amber-glow)'
                              : 'var(--bg-surface)',
                            color: isDemonstrated
                              ? 'var(--accent-emerald)'
                              : isPartial
                              ? 'var(--accent-amber)'
                              : 'var(--text-dim)',
                            border: `1px solid ${
                              isDemonstrated
                                ? 'var(--accent-emerald)'
                                : isPartial
                                ? 'var(--accent-amber)'
                                : 'var(--border-subtle)'
                            }`,
                          }}
                        >
                          {a.status}
                        </span>
                        {a.carried_forward && (
                          <span
                            style={{
                              fontSize: '11px',
                              backgroundColor: 'var(--bg-surface)',
                              color: 'var(--text-dim)',
                              padding: '2px 6px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            Carried Forward
                          </span>
                        )}
                      </div>

                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
                        {a.requirement_name}
                      </h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0, lineHeight: '1.5' }}>
                        {a.summary}
                      </p>
                    </div>

                    {a.evidence && a.evidence.length > 0 && (
                      <button
                        data-testid="toggle-evidence-btn"
                        onClick={() => toggleEvidence(assessmentKey)}
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          border: '1px solid var(--border-card)',
                          color: 'var(--accent-cyan)',
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        {isExpanded ? 'Hide Code Citations' : `View Citations (${a.evidence.length})`}
                      </button>
                    )}
                  </div>

                  {a.limitation && (
                    <div style={{ fontSize: '12px', color: 'var(--accent-amber)', marginTop: '8px', backgroundColor: 'var(--bg-surface)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                      <strong>Assessment Boundary:</strong> {a.limitation}
                    </div>
                  )}

                  {/* Expandable Evidence Code View */}
                  {isExpanded && a.evidence && (
                    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {a.evidence.map((ev, eIdx) => (
                        <div
                          key={eIdx}
                          style={{
                            backgroundColor: 'var(--bg-app)',
                            border: '1px solid var(--border-card)',
                            borderRadius: 'var(--radius-sm)',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              padding: '8px 14px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '12px',
                              borderBottom: '1px solid var(--border-subtle)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                                {ev.file_path}:{ev.line_start}-{ev.line_end}
                              </span>
                              <span style={{ fontSize: '10px', backgroundColor: 'var(--bg-surface-elevated)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)' }}>
                                {ev.detector}
                              </span>
                            </div>
                            <span style={{ color: 'var(--accent-emerald)', fontSize: '11px', fontWeight: 600 }}>
                              ✓ Skeptic Verified
                            </span>
                          </div>

                          <pre
                            style={{
                              padding: '12px 14px',
                              margin: 0,
                              fontSize: '12px',
                              color: 'var(--text-main)',
                              fontFamily: 'JetBrains Mono, monospace',
                              overflowX: 'auto',
                              lineHeight: '1.5',
                            }}
                          >
                            {ev.snippet}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
