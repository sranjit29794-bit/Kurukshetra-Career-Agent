import React, { useEffect, useState, useCallback } from 'react';
import type {
  AnalysisDetail,
  DiffResponse,
  ErrorResponse,
  TrackDetail,
  CoachingResponse,
  AgentEventDetail,
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
  const [history, setHistory] = useState<AnalysisDetail[]>([]);
  const [activeAnalysis, setActiveAnalysis] = useState<AnalysisDetail | null>(null);
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});

  // Manual Check / Watcher State
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  // Primary Section Tab: 'evidence' | 'diff' | 'timeline' | 'coaching'
  const [primaryTab, setPrimaryTab] = useState<'evidence' | 'diff' | 'timeline' | 'coaching'>('evidence');

  // Filter Tab for Evidence Inspector: 'all' | 'demonstrated' | 'partial' | 'not_demonstrated'
  const [evidenceFilter, setEvidenceFilter] = useState<'all' | 'demonstrated' | 'partial' | 'not_demonstrated'>('all');

  // Diff Engine State within Track View
  const [diffData, setDiffData] = useState<DiffResponse | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [diffFromId, setDiffFromId] = useState<string>('');
  const [diffToId, setDiffToId] = useState<string>('');

  // Grounded Coaching State
  const [coachingData, setCoachingData] = useState<CoachingResponse | null>(null);
  const [coachingLoading, setCoachingLoading] = useState(false);
  const [coachingError, setCoachingError] = useState<string | null>(null);

  // Track Multi-Agent Events State
  const [trackEvents, setTrackEvents] = useState<AgentEventDetail[]>([]);
  const [trackEventsLoading, setTrackEventsLoading] = useState(false);

  const fetchCoaching = useCallback(async () => {
    setCoachingLoading(true);
    setCoachingError(null);
    try {
      const res = await fetch(`${API_BASE}/api/tracks/${trackId}/coaching`);
      if (res.ok) {
        const data: CoachingResponse = await res.json();
        setCoachingData(data);
      } else {
        const err = await res.json().catch(() => null);
        setCoachingError(err?.error?.message || 'Coaching guidance unavailable');
      }
    } catch (err: any) {
      setCoachingError(err.message || 'Failed to fetch coaching guidance');
    } finally {
      setCoachingLoading(false);
    }
  }, [trackId]);

  const fetchTrackEvents = useCallback(async () => {
    setTrackEventsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/tracks/${trackId}/events`);
      if (res.ok) {
        const data: AgentEventDetail[] = await res.json();
        setTrackEvents(data);
      }
    } catch {
      // Ignore background event fetch error
    } finally {
      setTrackEventsLoading(false);
    }
  }, [trackId]);

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
          if (isMounted) {
            setHistory(historyData);
            if (historyData.length > 0) {
              setActiveAnalysis(historyData[0]);
              if (historyData.length >= 2) {
                setDiffFromId(String(historyData[1].id));
                setDiffToId(String(historyData[0].id));
              }
            }
          }
        }

        fetchCoaching();
        fetchTrackEvents();
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to load track data');
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [trackId, fetchCoaching, fetchTrackEvents]);

  // Load Diff comparison when diff tab is selected or comparing arbitrary analyses
  const fetchDiff = async (fromId?: string, toId?: string) => {
    setDiffLoading(true);
    setDiffError(null);
    try {
      let url = `${API_BASE}/api/tracks/${trackId}/diff`;
      const params = new URLSearchParams();
      if (fromId) params.append('from_analysis_id', fromId);
      if (toId) params.append('to_analysis_id', toId);
      const q = params.toString();
      if (q) url += `?${q}`;

      const res = await fetch(url);
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || 'Diff comparison unavailable');
      }
      const data: DiffResponse = await res.json();
      setDiffData(data);
    } catch (err: any) {
      setDiffError(err.message || 'Failed to compute diff');
    } finally {
      setDiffLoading(false);
    }
  };


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
      const newAnalysis = data as AnalysisDetail;
      setActiveAnalysis(newAnalysis);
      reloadTrackData();
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
        setHistory(historyData);
        if (historyData.length > 0) {
          setActiveAnalysis(historyData[0]);
        }
      }
      fetchCoaching();
      fetchTrackEvents();
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
        setCheckMessage(`Repository is up to date (HEAD is ${data.current_sha?.slice(0, 8) || 'current'}).`);
      }
    } catch (err: any) {
      setCheckMessage('Watcher check failed: ' + (err.message || 'Network error'));
    } finally {
      setCheckLoading(false);
    }
  };

  const handleSelectSnapshot = async (analysisId: number) => {
    setAnalysisLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/tracks/${trackId}/analyses/${analysisId}`);
      if (res.ok) {
        const data = await res.json();
        setActiveAnalysis(data);
        setPrimaryTab('evidence');
      } else {
        // Fallback to local history search
        const match = history.find((h) => h.id === analysisId);
        if (match) {
          setActiveAnalysis(match);
          setPrimaryTab('evidence');
        }
      }
    } catch {
      const match = history.find((h) => h.id === analysisId);
      if (match) {
        setActiveAnalysis(match);
        setPrimaryTab('evidence');
      }
    } finally {
      setAnalysisLoading(false);
    }
  };

  const toggleEvidence = (key: string) => {
    setExpandedEvidence((prev) => ({
      ...prev,
      [key]: !prev[key],
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
            backgroundColor: 'var(--accent-primary)',
            color: '#ffffff',
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

  const latestHistoryAnalysis = history.length > 0 ? history[0] : null;
  const isViewingHistorical = activeAnalysis && latestHistoryAnalysis && activeAnalysis.id !== latestHistoryAnalysis.id;
  const isFixtureTrack =
    track.repo.owner === 'targetdev' ||
    track.repo.html_url?.includes('targetdev') ||
    Boolean(activeAnalysis?.commit_sha?.startsWith('11111111')) ||
    Boolean(activeAnalysis?.commit_sha?.startsWith('22222222')) ||
    Boolean(activeAnalysis?.commit_sha?.startsWith('deadbeef'));

  const assessments = activeAnalysis?.assessments || [];
  const demonstratedCount = assessments.filter((a) => a.status === 'DEMONSTRATED').length;
  const partialCount = assessments.filter((a) => a.status === 'PARTIAL').length;
  const notDemonstratedCount = assessments.filter((a) => a.status === 'NOT_DEMONSTRATED').length;

  const filteredAssessments = assessments.filter((a) => {
    if (evidenceFilter === 'demonstrated') return a.status === 'DEMONSTRATED';
    if (evidenceFilter === 'partial') return a.status === 'PARTIAL';
    if (evidenceFilter === 'not_demonstrated') return a.status === 'NOT_DEMONSTRATED' || a.status === 'UNABLE_TO_ASSESS';
    return true;
  });

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1180px', margin: '0 auto', padding: '36px 24px' }}>
      {/* Breadcrumb Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <span onClick={() => onNavigate('/')} style={{ color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 600 }}>
            Console
          </span>
          <span style={{ color: 'var(--text-dim)' }}>/</span>
          <span style={{ color: 'var(--text-muted)' }}>Career Track #{trackId}</span>
          {isViewingHistorical && (
            <>
              <span style={{ color: 'var(--text-dim)' }}>/</span>
              <span style={{ backgroundColor: 'var(--accent-amber-glow)', color: 'var(--accent-amber)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                Historical Snapshot #{activeAnalysis?.id}
              </span>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
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

      {/* Test Fixture Disclosure Banner */}
      {isFixtureTrack && (
        <div
          style={{
            backgroundColor: 'var(--accent-partial-bg)',
            border: '1px solid var(--accent-partial)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 20px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '20px' }}>🧪</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-partial)', marginBottom: '2px' }}>
              AUTOMATED TEST FIXTURE DATASET
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              Track #{trackId} references synthetic evaluation records generated by the regression test suite (<code>tests/test_phase4_push_and_diff.py</code>). Commit hashes (e.g. <code>11111111</code>, <code>22222222</code>) are simulated fixtures. Connect a real public GitHub repository in the wizard for live commit citations.
            </div>
          </div>
        </div>
      )}

      {/* Historical Snapshot Alert Banner */}
      {isViewingHistorical && (
        <div
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--accent-amber)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 20px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>📜</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                Auditing Historical Evaluation Snapshot: Commit <code style={{ color: 'var(--accent-primary)' }}>{activeAnalysis?.commit_sha?.slice(0, 8)}</code>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Recorded on {activeAnalysis?.started_at ? new Date(activeAnalysis.started_at).toLocaleString() : 'past date'}. Citations are immutable and bound to this SHA.
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              if (latestHistoryAnalysis) setActiveAnalysis(latestHistoryAnalysis);
            }}
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              border: 'none',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            Return to Latest HEAD →
          </button>
        </div>
      )}

      {/* Track Profile Banner */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px',
          marginBottom: '24px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {track.job.company || 'Direct Job'}
              </span>
              <span style={{ color: 'var(--text-dim)' }}>•</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{track.job.source_type}</span>
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 10px 0', fontFamily: 'var(--font-sans)', letterSpacing: '-0.02em' }}>
              {track.job.title}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '13px', color: 'var(--text-muted)' }}>
              <div>
                Repository:{' '}
                <a
                  href={track.repo.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent-primary)', fontWeight: 600 }}
                >
                  {track.repo.owner}/{track.repo.name} ↗
                </a>
              </div>
              <div>
                Branch: <code style={{ color: 'var(--text-main)' }}>{track.branch}</code>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Pinned SHA:</span>
                <code style={{ backgroundColor: 'var(--bg-surface-elevated)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', color: 'var(--accent-verified)', fontSize: '12px' }}>
                  {track.last_seen_sha ? track.last_seen_sha.slice(0, 8) : 'Pending'}
                </code>
              </div>
              <div>
                {isFixtureTrack ? (
                  <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: 'var(--accent-partial-bg)', color: 'var(--accent-partial)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(217, 119, 6, 0.3)' }}>
                    🧪 Test Fixture
                  </span>
                ) : (
                  <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: 'var(--accent-verified-bg)', color: 'var(--accent-verified)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    ● Live Public GitHub
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '220px' }}>
            <button
              onClick={handleRunAssessment}
              disabled={analysisLoading}
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
                border: 'none',
                padding: '12px 20px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                fontSize: '13px',
                boxShadow: 'var(--shadow-md)',
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
                  <span>{activeAnalysis ? 'Re-run Assessment' : 'Run Deterministic Assessment'}</span>
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
              borderLeft: '4px solid var(--accent-primary)',
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
          <div style={{ backgroundColor: 'rgba(225,29,72,0.1)', border: '1px solid var(--accent-rose)', borderRadius: 'var(--radius-sm)', padding: '12px', color: 'var(--accent-rose)', fontSize: '13px', marginTop: '14px' }}>
            <strong>Assessment Error:</strong> {analysisError}
          </div>
        )}
      </div>

      {/* Main Feature Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '28px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setPrimaryTab('evidence')}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: primaryTab === 'evidence' ? '3px solid var(--accent-primary)' : '3px solid transparent',
            color: primaryTab === 'evidence' ? 'var(--text-main)' : 'var(--text-muted)',
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>🔎</span>
          <span>Skill Scorecard & Evidence Inspector</span>
          <span style={{ fontSize: '11px', backgroundColor: 'var(--bg-surface-elevated)', padding: '2px 8px', borderRadius: '10px' }}>
            {assessments.length}
          </span>
        </button>

        <button
          onClick={() => {
            setPrimaryTab('diff');
            if (!diffData && history.length >= 2) {
              fetchDiff(diffFromId, diffToId);
            }
          }}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: primaryTab === 'diff' ? '3px solid var(--accent-primary)' : '3px solid transparent',
            color: primaryTab === 'diff' ? 'var(--text-main)' : 'var(--text-muted)',
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>📊</span>
          <span>Before & After Diff Engine</span>
        </button>

        <button
          onClick={() => setPrimaryTab('timeline')}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: primaryTab === 'timeline' ? '3px solid var(--accent-primary)' : '3px solid transparent',
            color: primaryTab === 'timeline' ? 'var(--text-main)' : 'var(--text-muted)',
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>⏱️</span>
          <span>Evaluation Timeline & History</span>
          <span style={{ fontSize: '11px', backgroundColor: 'var(--bg-surface-elevated)', padding: '2px 8px', borderRadius: '10px' }}>
            {history.length}
          </span>
        </button>

        <button
          onClick={() => {
            setPrimaryTab('coaching');
            if (!coachingData) fetchCoaching();
          }}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: primaryTab === 'coaching' ? '3px solid var(--accent-primary)' : '3px solid transparent',
            color: primaryTab === 'coaching' ? 'var(--text-main)' : 'var(--text-muted)',
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>🎯</span>
          <span>Grounded Career Coaching</span>
          {coachingData && (
            <span style={{ fontSize: '11px', backgroundColor: 'var(--accent-primary-glow)', color: 'var(--accent-primary)', padding: '2px 8px', borderRadius: '10px', fontWeight: 800 }}>
              {coachingData.gaps_count} Actionable
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: Skill Scorecard & Evidence Inspector */}
      {/* ========================================================================= */}
      {primaryTab === 'evidence' && (
        <div className="animate-fade-in">
          {/* Summary Scorecard Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
            <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', padding: '18px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 700 }}>
                Job Requirements
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-main)' }}>
                {track.job.requirements.length}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Extracted from job posting</div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', padding: '18px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 700 }}>
                Demonstrated (Verified)
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--accent-verified)' }}>
                {demonstratedCount}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Verifiable AST code proof</div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', padding: '18px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 700 }}>
                Partial Evidence
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--accent-partial)' }}>
                {partialCount}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Detected partial signals</div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', padding: '18px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 700 }}>
                Scope Gaps
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-dim)' }}>
                {notDemonstratedCount}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Not observed in checked files</div>
            </div>
          </div>

          {/* Evidence Inspector Matrix */}
          <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)', padding: '28px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Evidence Intelligence Matrix
                </h2>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Evaluating commit <code style={{ color: 'var(--accent-primary)' }}>{activeAnalysis?.commit_sha ? activeAnalysis.commit_sha.slice(0, 8) : 'pending'}</code> via Skeptic Verifier AST citations
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
                    onClick={() => setEvidenceFilter(tab.id as any)}
                    style={{
                      backgroundColor: evidenceFilter === tab.id ? 'var(--bg-surface)' : 'transparent',
                      color: evidenceFilter === tab.id ? 'var(--accent-primary)' : 'var(--text-muted)',
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
                    backgroundColor: 'var(--accent-primary)',
                    color: '#ffffff',
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {filteredAssessments.map((a, idx) => {
                  const assessmentKey = `req-${a.requirement_id || idx}`;
                  const isExpanded = !!expandedEvidence[assessmentKey];
                  const isDemonstrated = a.status === 'DEMONSTRATED';
                  const isPartial = a.status === 'PARTIAL';
                  const isNotDemonstrated = a.status === 'NOT_DEMONSTRATED';

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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: isDemonstrated
                                  ? 'var(--accent-verified-bg)'
                                  : isPartial
                                  ? 'var(--accent-partial-bg)'
                                  : 'var(--bg-surface)',
                                color: isDemonstrated
                                  ? 'var(--accent-verified)'
                                  : isPartial
                                  ? 'var(--accent-partial)'
                                  : 'var(--text-dim)',
                                border: `1px solid ${
                                  isDemonstrated
                                    ? 'var(--accent-verified)'
                                    : isPartial
                                    ? 'var(--accent-partial)'
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
                              color: 'var(--accent-primary)',
                              padding: '6px 14px',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '12px',
                              fontWeight: 600,
                            }}
                          >
                            {isExpanded ? 'Hide Code Citations' : `View Citations (${a.evidence.length})`}
                          </button>
                        )}
                      </div>

                      {/* Honest Absence Caveat Box when NOT_DEMONSTRATED */}
                      {isNotDemonstrated && (
                        <div
                          style={{
                            marginTop: '12px',
                            backgroundColor: 'var(--bg-surface)',
                            borderLeft: '4px solid var(--text-dim)',
                            padding: '10px 14px',
                            borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                            fontSize: '12px',
                            color: 'var(--text-muted)',
                            lineHeight: '1.5',
                          }}
                        >
                          <strong style={{ color: 'var(--text-main)' }}>Scope Caveat:</strong> Evidence for this requirement was not detected within the analyzed repository scope for commit <code style={{ color: 'var(--text-main)' }}>{activeAnalysis?.commit_sha?.slice(0, 8)}</code>. This does <em>not</em> indicate a lack of student skill—only that matching code patterns were not found in the examined files.
                        </div>
                      )}

                      {a.limitation && (
                        <div style={{ fontSize: '12px', color: 'var(--accent-partial)', marginTop: '10px', backgroundColor: 'var(--bg-surface)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                          <strong>Assessment Boundary:</strong> {a.limitation}
                        </div>
                      )}

                      {/* Expandable Evidence Code View */}
                      {isExpanded && a.evidence && (
                        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {a.evidence.map((ev, eIdx) => {
                            const commitSha = activeAnalysis?.commit_sha || track.last_seen_sha || 'main';
                            const commitPinnedUrl = ev.github_url || `https://github.com/${track.repo.owner}/${track.repo.name}/blob/${commitSha}/${ev.file_path}#L${ev.line_start}-L${ev.line_end}`;

                            return (
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
                                    padding: '10px 14px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    fontSize: '12px',
                                    borderBottom: '1px solid var(--border-subtle)',
                                    flexWrap: 'wrap',
                                    gap: '8px',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span style={{ color: 'var(--accent-primary)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                                      {ev.file_path}:{ev.line_start}-{ev.line_end}
                                    </span>
                                    <span style={{ fontSize: '10px', backgroundColor: 'var(--bg-surface-elevated)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)' }}>
                                      {ev.detector}
                                    </span>
                                    <span style={{ color: 'var(--accent-verified)', fontSize: '11px', fontWeight: 600 }}>
                                      ✓ Skeptic Verified
                                    </span>
                                  </div>

                                  {/* Immutable Commit-Pinned GitHub Anchor Button */}
                                  <a
                                    href={commitPinnedUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      backgroundColor: 'var(--bg-surface-elevated)',
                                      border: '1px solid var(--border-card)',
                                      color: 'var(--accent-primary)',
                                      padding: '4px 10px',
                                      borderRadius: 'var(--radius-sm)',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      textDecoration: 'none',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                    }}
                                    title={`Open exact file lines at pinned commit ${commitSha}`}
                                  >
                                    <span>Open at Commit {commitSha.slice(0, 8)}</span>
                                    <span>↗</span>
                                  </a>
                                </div>

                                <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
                                  <pre
                                    style={{
                                      padding: '14px',
                                      margin: 0,
                                      fontSize: '12px',
                                      color: 'var(--text-main)',
                                      fontFamily: 'JetBrains Mono, monospace',
                                      lineHeight: '1.6',
                                    }}
                                  >
                                    {ev.snippet}
                                  </pre>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: Before & After Diff Engine */}
      {/* ========================================================================= */}
      {primaryTab === 'diff' && (
        <div className="animate-fade-in">
          {/* Comparison Selector Controls */}
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
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Base Analysis (From)
                  </label>
                  <select
                    value={diffFromId}
                    onChange={(e) => setDiffFromId(e.target.value)}
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
                        #{h.id} - {h.commit_sha.slice(0, 8)} ({new Date(h.started_at).toLocaleTimeString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ fontSize: '18px', color: 'var(--text-dim)', paddingTop: '16px' }}>➔</div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Target Analysis (To)
                  </label>
                  <select
                    value={diffToId}
                    onChange={(e) => setDiffToId(e.target.value)}
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
                        #{h.id} - {h.commit_sha.slice(0, 8)} ({new Date(h.started_at).toLocaleTimeString()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={() => fetchDiff(diffFromId, diffToId)}
                disabled={diffLoading || diffFromId === diffToId}
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '9px 18px',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: diffFromId === diffToId ? 'not-allowed' : 'pointer',
                  opacity: diffFromId === diffToId ? 0.6 : 1,
                }}
              >
                {diffLoading ? 'Computing Diff...' : 'Compare Selected Analyses'}
              </button>
            </div>
          )}

          {diffLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)' }}>
              Computing before-and-after assessment comparison...
            </div>
          ) : diffError || !diffData ? (
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
                No Consecutive Runs to Diff
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '480px', margin: '0 auto 20px auto', lineHeight: '1.6' }}>
                At least two distinct evaluations at different commit SHAs are required to compute a diff. Push new code or trigger a new assessment on an advanced commit.
              </p>
              <button
                onClick={handleRunAssessment}
                disabled={analysisLoading}
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
                Run Reassessment →
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
                  marginBottom: '24px',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 700 }}>
                      Previous SHA
                    </div>
                    <code style={{ fontSize: '14px', color: 'var(--text-muted)', backgroundColor: 'var(--bg-surface-elevated)', padding: '3px 8px', borderRadius: 'var(--radius-sm)' }}>
                      {diffData.from_sha ? diffData.from_sha.slice(0, 8) : 'Initial'}
                    </code>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 700 }}>
                      New Advanced SHA
                    </div>
                    <code style={{ fontSize: '14px', color: 'var(--accent-verified)', backgroundColor: 'var(--bg-surface-elevated)', padding: '3px 8px', borderRadius: 'var(--radius-sm)' }}>
                      {diffData.to_sha.slice(0, 8)}
                    </code>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 700 }}>
                      Files Modified
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>
                      {diffData.files_changed.length} files
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 700 }}>
                      Reassessed vs Carried
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-primary)' }}>
                      {diffData.reassessed_count} reassessed / {diffData.carried_forward_count} carried
                    </div>
                  </div>
                </div>

                {diffData.commit_message && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', fontSize: '13px', color: 'var(--text-muted)' }}>
                    <strong>Commit Message:</strong> <span style={{ color: 'var(--text-main)' }}>{diffData.commit_message}</span>
                  </div>
                )}
              </div>

              {/* Changed Files */}
              {diffData.files_changed.length > 0 && (
                <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', padding: '16px 20px', marginBottom: '24px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Changed File Paths
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {diffData.files_changed.map((f, fIdx) => (
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

              {/* Requirement Deltas */}
              <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 16px 0' }}>
                  Skill Requirement Progression
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {diffData.items.map((item, idx) => {
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

                          {/* Before -> After Status */}
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
                              + NEW EVIDENCE VERIFIED AT COMMIT {diffData.to_sha.slice(0, 8)}
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
                                    Inspect Anchor ↗
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
      )}

      {/* ========================================================================= */}
      {/* TAB 3: Evaluation Timeline & Audit History */}
      {/* ========================================================================= */}
      {primaryTab === 'timeline' && (
        <div className="animate-fade-in">
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-lg)',
              padding: '28px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
                Evaluation Timeline & Audit Log
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
                Chronological ledger of every deterministic code analysis run for this career track. Each evaluation is immutable and permanently bound to its exact commit SHA.
              </p>
            </div>

            {history.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No historical evaluations recorded yet. Run an assessment to generate your first audit log entry.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {history.map((h, idx) => {
                  const isLatest = idx === 0;
                  const isActive = activeAnalysis?.id === h.id;
                  const demCount = h.assessments.filter((a) => a.status === 'DEMONSTRATED').length;
                  const partCount = h.assessments.filter((a) => a.status === 'PARTIAL').length;
                  const gapCount = h.assessments.filter((a) => a.status === 'NOT_DEMONSTRATED').length;

                  return (
                    <div
                      key={h.id}
                      style={{
                        backgroundColor: 'var(--bg-surface-elevated)',
                        border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                        borderRadius: 'var(--radius-md)',
                        padding: '20px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '16px',
                        transition: 'border-color 0.2s ease',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 800,
                              fontFamily: 'JetBrains Mono, monospace',
                              backgroundColor: 'var(--bg-surface)',
                              color: 'var(--text-main)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                            }}
                          >
                            RUN #{h.id}
                          </span>
                          <code
                            style={{
                              fontSize: '12px',
                              backgroundColor: 'var(--bg-surface)',
                              color: 'var(--accent-primary)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                            }}
                          >
                            {h.commit_sha.slice(0, 8)}
                          </code>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor:
                                h.trigger === 'webhook'
                                  ? 'var(--accent-primary-glow)'
                                  : h.trigger === 'poll'
                                  ? 'rgba(147, 51, 234, 0.1)'
                                  : 'var(--bg-surface)',
                              color:
                                h.trigger === 'webhook'
                                  ? 'var(--accent-primary)'
                                  : h.trigger === 'poll'
                                  ? '#9333ea'
                                  : 'var(--text-dim)',
                            }}
                          >
                            {h.trigger.toUpperCase()}
                          </span>
                          {isLatest && (
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 800,
                                backgroundColor: 'var(--accent-verified-bg)',
                                color: 'var(--accent-verified)',
                                padding: '2px 8px',
                                borderRadius: '4px',
                              }}
                            >
                              LATEST HEAD
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600, marginBottom: '4px' }}>
                          {h.commit_message || `Evaluated commit ${h.commit_sha.slice(0, 8)}`}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                          <span>{new Date(h.started_at).toLocaleString()}</span>
                          <span>•</span>
                          <span style={{ color: 'var(--accent-verified)' }}>{demCount} Demonstrated</span>
                          <span>•</span>
                          <span style={{ color: 'var(--accent-partial)' }}>{partCount} Partial</span>
                          <span>•</span>
                          <span>{gapCount} Gaps</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {isActive ? (
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-primary)' }}>
                            Currently Viewing
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSelectSnapshot(h.id)}
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              border: '1px solid var(--border-card)',
                              color: 'var(--text-main)',
                              padding: '8px 14px',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '12px',
                              fontWeight: 600,
                            }}
                          >
                            Inspect Snapshot ↗
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Transparent Agent Execution Ledger for this Track */}
            <div style={{ marginTop: '36px', paddingTop: '28px', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span className="live-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-verified)', display: 'inline-block' }} />
                    <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      TRANSPARENT MULTI-AGENT EXECUTION LOG
                    </span>
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Track #{trackId} Agent Run Ledger
                  </h3>
                </div>

                <button
                  onClick={fetchTrackEvents}
                  disabled={trackEventsLoading}
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {trackEventsLoading ? 'Loading...' : '↻ Refresh Log'}
                </button>
              </div>

              {trackEvents.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)' }}>
                  No agent execution records logged for this track yet. Run an assessment to populate the audit ledger.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {trackEvents.map((evt) => (
                    <div
                      key={evt.id}
                      style={{
                        backgroundColor: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '12px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            backgroundColor: 'var(--bg-surface)',
                            color: 'var(--accent-primary)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          {evt.agent}
                        </span>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            backgroundColor: evt.level === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-surface)',
                            color: evt.level === 'error' ? 'var(--accent-rose)' : 'var(--text-dim)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          {evt.level.toUpperCase()}
                        </span>
                        <span style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 500 }}>
                          {evt.message}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--text-dim)' }}>
                        {evt.commit_sha && (
                          <code style={{ fontSize: '11px', color: 'var(--accent-verified)', backgroundColor: 'var(--bg-surface)', padding: '2px 6px', borderRadius: '4px' }}>
                            {evt.commit_sha.slice(0, 7)}
                          </code>
                        )}
                        <span>{new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: Grounded Career Coaching System */}
      {/* ========================================================================= */}
      {primaryTab === 'coaching' && (
        <div className="animate-fade-in">
          {coachingLoading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <div className="live-pulse" style={{ fontSize: '28px', marginBottom: '12px' }}>🎯</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                Generating Evidence-Grounded Coaching Plan...
              </div>
              <div style={{ fontSize: '13px' }}>
                Analyzing requirement coverage, inspecting verified AST citations, and synthesizing deterministic code guidance.
              </div>
            </div>
          ) : coachingError ? (
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--accent-rose)',
                borderRadius: 'var(--radius-lg)',
                padding: '32px',
                textAlign: 'center',
              }}
            >
              <h3 style={{ color: 'var(--accent-rose)', margin: '0 0 10px 0' }}>Coaching Recommendations Unavailable</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>{coachingError}</p>
              <button
                onClick={fetchCoaching}
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
                Retry Coaching Analysis
              </button>
            </div>
          ) : !coachingData ? (
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-card)',
                borderRadius: 'var(--radius-lg)',
                padding: '40px',
                textAlign: 'center',
                color: 'var(--text-muted)',
              }}
            >
              Run an assessment to unlock grounded career coaching recommendations.
            </div>
          ) : (
            <div>
              {/* Coaching Executive Overview Card */}
              <div
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '28px',
                  marginBottom: '24px',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', marginBottom: '20px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          backgroundColor: 'var(--accent-primary-glow)',
                          color: 'var(--accent-primary)',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                        }}
                      >
                        GROUNDED CAREER COACHING
                      </span>
                      <span style={{ color: 'var(--text-dim)' }}>•</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {coachingData.ai_used ? 'AI Synthesized' : 'Deterministic Grounded Inference Engine'}
                      </span>
                    </div>

                    <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
                      Readiness Roadmap for {coachingData.track_title}
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0, maxWidth: '720px', lineHeight: '1.5' }}>
                      {coachingData.summary}
                    </p>
                  </div>

                  {/* Summary Metric Badges */}
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <div
                      style={{
                        backgroundColor: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-card)',
                        borderRadius: 'var(--radius-md)',
                        padding: '14px 20px',
                        textAlign: 'center',
                        minWidth: '130px',
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-verified)', textTransform: 'uppercase' }}>
                        Verified Strengths
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                        {coachingData.strengths_count}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Backed by AST proof</div>
                    </div>

                    <div
                      style={{
                        backgroundColor: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-card)',
                        borderRadius: 'var(--radius-md)',
                        padding: '14px 20px',
                        textAlign: 'center',
                        minWidth: '130px',
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-amber)', textTransform: 'uppercase' }}>
                        Actionable Gaps
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                        {coachingData.gaps_count}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>With taxonomy guides</div>
                    </div>
                  </div>
                </div>

                {/* Honest Scope and Verification Integrity Disclaimer */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderLeft: '4px solid var(--accent-primary)',
                    borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}
                >
                  <span style={{ fontSize: '18px', lineHeight: 1 }}>🛡️</span>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    <strong style={{ color: 'var(--text-main)' }}>DevProof Evidence-Integrity Guarantee:</strong>{' '}
                    Lack of detected code in this repository does <span style={{ textDecoration: 'underline' }}>not</span> imply you lack this engineering skill—it only indicates that matching code was not observed within the scanned repository files. Furthermore, recommendations are classified as suggestions and <strong style={{ color: 'var(--accent-verified)' }}>only convert to verified proof</strong> after you push code changes and targeted reassessment confirms the result.
                  </div>
                </div>
              </div>

              {/* Coaching Items List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {coachingData.items.map((item) => {
                  const isStrength = item.status_claim === 'verified_strength';
                  const priorityColor =
                    item.priority.toLowerCase() === 'high'
                      ? 'var(--accent-rose)'
                      : item.priority.toLowerCase() === 'medium'
                      ? 'var(--accent-amber)'
                      : 'var(--text-dim)';

                  return (
                    <div
                      key={item.requirement_id}
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        border: isStrength ? '1px solid var(--accent-verified)' : '1px solid var(--border-card)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '24px',
                        boxShadow: 'var(--shadow-sm)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {/* Item Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: '14px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                            {/* Status Claim Badge */}
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 800,
                                backgroundColor: isStrength ? 'var(--accent-verified-bg)' : 'rgba(59, 130, 246, 0.1)',
                                color: isStrength ? 'var(--accent-verified)' : '#3b82f6',
                                padding: '3px 9px',
                                borderRadius: '4px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                              }}
                            >
                              {isStrength ? '✓ Verified Strength' : '🎯 Actionable Recommendation'}
                            </span>

                            {/* Priority Badge */}
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: priorityColor,
                                backgroundColor: 'var(--bg-surface-elevated)',
                                padding: '3px 8px',
                                borderRadius: '4px',
                              }}
                            >
                              {item.priority.toUpperCase()} PRIORITY
                            </span>

                            {/* Category Badge */}
                            <span
                              style={{
                                fontSize: '11px',
                                color: 'var(--text-dim)',
                                backgroundColor: 'var(--bg-surface-elevated)',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontWeight: 600,
                              }}
                            >
                              {item.category}
                            </span>
                          </div>

                          <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px 0' }}>
                            {item.action_title}
                          </h3>
                          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            Requirement: <strong style={{ color: 'var(--text-main)' }}>{item.requirement_name}</strong>
                          </div>
                        </div>

                        {item.is_actionable && (
                          <div
                            style={{
                              backgroundColor: 'var(--bg-surface-elevated)',
                              border: '1px solid var(--border-subtle)',
                              padding: '6px 14px',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '12px',
                              color: 'var(--text-main)',
                              fontWeight: 600,
                            }}
                          >
                            ⏱️ Estimated Effort: <strong>{item.estimated_effort}</strong>
                          </div>
                        )}
                      </div>

                      {/* Explanation / Why */}
                      <div
                        style={{
                          backgroundColor: 'var(--bg-surface-elevated)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '12px 16px',
                          fontSize: '13px',
                          color: 'var(--text-main)',
                          marginBottom: '16px',
                          lineHeight: '1.5',
                        }}
                      >
                        <strong style={{ color: 'var(--accent-primary)' }}>Evidence Grounding:</strong> {item.why}
                      </div>

                      {/* Verified Proof Citations (for Strengths) */}
                      {item.verified_proof.length > 0 && (
                        <div style={{ marginTop: '12px', marginBottom: '16px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-verified)', marginBottom: '8px' }}>
                            Pinned Code Proof Citations ({item.verified_proof.length}):
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {item.verified_proof.map((proof, pIdx) => (
                              <div
                                key={pIdx}
                                style={{
                                  backgroundColor: 'var(--bg-surface-elevated)',
                                  border: '1px solid var(--border-card)',
                                  borderRadius: 'var(--radius-sm)',
                                  padding: '12px 14px',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '12px' }}>📄</span>
                                    <code style={{ fontSize: '12px', color: 'var(--accent-primary)', fontWeight: 700 }}>
                                      {proof.file_path}:L{proof.line_start}-{proof.line_end}
                                    </code>
                                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', backgroundColor: 'var(--bg-surface)', padding: '2px 6px', borderRadius: '4px' }}>
                                      {proof.detector}
                                    </span>
                                  </div>

                                  {proof.github_url && (
                                    <a
                                      href={proof.github_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        color: 'var(--accent-primary)',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        textDecoration: 'none',
                                      }}
                                    >
                                      Inspect on GitHub ↗
                                    </a>
                                  )}
                                </div>

                                {proof.snippet && (
                                  <pre
                                    style={{
                                      margin: 0,
                                      padding: '8px 12px',
                                      backgroundColor: 'var(--bg-surface)',
                                      borderRadius: '4px',
                                      fontSize: '12px',
                                      fontFamily: 'JetBrains Mono, monospace',
                                      color: 'var(--text-main)',
                                      overflowX: 'auto',
                                    }}
                                  >
                                    {proof.snippet}
                                  </pre>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Implementation Guide (for Gaps) */}
                      {item.is_actionable && (
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '6px' }}>
                            Step-by-Step Implementation Guide:
                          </div>
                          <div
                            style={{
                              backgroundColor: 'var(--bg-surface-elevated)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '14px 16px',
                              fontSize: '13px',
                              lineHeight: '1.6',
                              color: 'var(--text-main)',
                            }}
                          >
                            <p style={{ margin: '0 0 10px 0' }}>{item.implementation_guide}</p>

                            {item.scope_caveat && (
                              <div style={{ fontSize: '12px', color: 'var(--text-dim)', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', marginTop: '8px' }}>
                                <em>Inspection scope note: {item.scope_caveat}</em>
                              </div>
                            )}

                            <div
                              style={{
                                marginTop: '10px',
                                paddingTop: '8px',
                                borderTop: '1px dashed var(--border-subtle)',
                                fontSize: '11px',
                                color: 'var(--accent-amber)',
                                fontWeight: 600,
                              }}
                            >
                              ⏳ Status: Recommendation Only. Pushing code satisfying this requirement will automatically trigger SkepticVerifier reassessment and elevate this to Verified Strength.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
