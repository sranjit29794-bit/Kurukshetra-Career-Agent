import React, { useEffect, useState, useRef } from 'react';
import type { AgentEventDetail } from '../types/contract';
import { API_BASE } from '../api/config';

interface ActivityFeedViewProps {
  onNavigate: (route: string) => void;
}

export const ActivityFeedView: React.FC<ActivityFeedViewProps> = ({ onNavigate }) => {
  const [events, setEvents] = useState<AgentEventDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);
  const [livePulse, setLivePulse] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Initial Fetch of persisted events
  const fetchPersistedEvents = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/events?limit=100`);
      if (!res.ok) throw new Error('Failed to fetch activity events');
      const data: AgentEventDetail[] = await res.json();
      setEvents(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Unable to connect to events log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/events?limit=100`);
        if (!res.ok) throw new Error('Failed to fetch activity events');
        const data: AgentEventDetail[] = await res.json();
        if (active) {
          setEvents(data);
          setError(null);
        }
      } catch (err: any) {
        if (active) setError(err.message || 'Unable to connect to events log');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadData();

    // Establish Server-Sent Events (SSE) connection for live audit broadcast
    if (isLiveStreaming && typeof window !== 'undefined' && window.EventSource) {
      try {
        const es = new EventSource(`${API_BASE}/api/events/stream`);
        eventSourceRef.current = es;

        es.onmessage = (event) => {
          try {
            const newEvt: AgentEventDetail = JSON.parse(event.data);
            setLivePulse(true);
            setTimeout(() => setLivePulse(false), 1200);

            setEvents((prev) => {
              // Avoid duplicates
              if (prev.some((e) => e.id === newEvt.id)) return prev;
              return [newEvt, ...prev].slice(0, 150);
            });
          } catch {
            // Ignore heartbeat or non-json keep-alive
          }
        };

        es.onerror = () => {
          // If SSE encounters issue, fallback smoothly to poll interval
          es.close();
        };
      } catch {
        // SSE unsupported or blocked
      }
    }

    const pollTimer = setInterval(() => {
      void loadData();
    }, 12000);

    return () => {
      active = false;
      clearInterval(pollTimer);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [isLiveStreaming]);

  const filteredEvents = events.filter((ev) => {
    if (agentFilter !== 'all' && ev.agent.toLowerCase() !== agentFilter.toLowerCase()) return false;
    if (levelFilter !== 'all' && ev.level.toLowerCase() !== levelFilter.toLowerCase()) return false;
    return true;
  });

  const getAgentTheme = (agent: string) => {
    switch (agent.toLowerCase()) {
      case 'reposcout':
        return {
          icon: '🧭',
          color: '#3b82f6',
          bg: 'rgba(59, 130, 246, 0.1)',
          border: 'rgba(59, 130, 246, 0.3)',
        };
      case 'skepticverifier':
        return {
          icon: '🛡️',
          color: '#a855f7',
          bg: 'rgba(168, 85, 247, 0.1)',
          border: 'rgba(168, 85, 247, 0.3)',
        };
      case 'evidenceengine':
        return {
          icon: '🔬',
          color: '#10b981',
          bg: 'rgba(16, 185, 129, 0.1)',
          border: 'rgba(16, 185, 129, 0.3)',
        };
      case 'changesentinel':
        return {
          icon: '⚡',
          color: '#f59e0b',
          bg: 'rgba(245, 158, 11, 0.1)',
          border: 'rgba(245, 158, 11, 0.3)',
        };
      default:
        return {
          icon: '🤖',
          color: 'var(--accent-primary)',
          bg: 'var(--accent-primary-glow)',
          border: 'var(--border-subtle)',
        };
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return { label: 'ERROR', color: 'var(--accent-rose)', bg: 'rgba(239, 68, 68, 0.1)' };
      case 'warning':
        return { label: 'WARNING', color: 'var(--accent-amber)', bg: 'rgba(245, 158, 11, 0.1)' };
      case 'success':
        return { label: 'VERIFIED', color: 'var(--accent-verified)', bg: 'var(--accent-verified-bg)' };
      default:
        return { label: 'INFO', color: 'var(--text-dim)', bg: 'var(--bg-surface)' };
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1180px', margin: '0 auto', padding: '36px 24px' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '20px' }}>
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
              REAL-TIME AUDIT FEED
            </span>
            <span style={{ color: 'var(--text-dim)' }}>•</span>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Transparent Multi-Agent Event Ledger</span>
          </div>

          <h1 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 10px 0', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            Transparent Activity & Execution Feed
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px', margin: 0, maxWidth: '780px', lineHeight: '1.6' }}>
            Every action performed by DevProof’s agentic pipeline—including AST scans by <strong style={{ color: 'var(--text-main)' }}>RepoScout</strong>, rigorous verification by <strong style={{ color: 'var(--text-main)' }}>SkepticVerifier</strong>, code extraction by <strong style={{ color: 'var(--text-main)' }}>EvidenceEngine</strong>, and commit monitoring by <strong style={{ color: 'var(--text-main)' }}>ChangeSentinel</strong>—is permanently persisted and audit-verifiable.
          </p>
        </div>

        {/* Live Stream Status Card */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-card)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            minWidth: '220px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: livePulse ? 'var(--accent-primary)' : 'var(--accent-verified)',
                  boxShadow: livePulse ? '0 0 12px var(--accent-primary)' : 'none',
                  transition: 'all 0.3s ease',
                  display: 'inline-block',
                }}
              />
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                {isLiveStreaming ? 'SSE Live Stream' : 'Static Snapshot'}
              </span>
            </div>
            <button
              onClick={() => setIsLiveStreaming((v) => !v)}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: 'var(--accent-primary)',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                padding: '2px 6px',
              }}
            >
              {isLiveStreaming ? 'Pause' : 'Resume'}
            </button>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {events.length} persisted records loaded from database
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        {/* Agent Filter Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', marginRight: '4px' }}>
            AGENT:
          </span>
          {[
            { id: 'all', label: 'All Agents' },
            { id: 'RepoScout', label: '🧭 RepoScout' },
            { id: 'SkepticVerifier', label: '🛡️ SkepticVerifier' },
            { id: 'EvidenceEngine', label: '🔬 EvidenceEngine' },
            { id: 'ChangeSentinel', label: '⚡ ChangeSentinel' },
          ].map((chip) => (
            <button
              key={chip.id}
              onClick={() => setAgentFilter(chip.id)}
              style={{
                backgroundColor: agentFilter.toLowerCase() === chip.id.toLowerCase() ? 'var(--accent-primary-glow)' : 'var(--bg-surface-elevated)',
                color: agentFilter.toLowerCase() === chip.id.toLowerCase() ? 'var(--accent-primary)' : 'var(--text-muted)',
                border: agentFilter.toLowerCase() === chip.id.toLowerCase() ? '1px solid var(--border-highlight)' : '1px solid var(--border-subtle)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Level Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)' }}>LEVEL:</span>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              color: 'var(--text-main)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>

          <button
            onClick={fetchPersistedEvents}
            title="Refresh database records"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-main)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Main Feed Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <div className="live-pulse" style={{ fontSize: '24px', marginBottom: '12px' }}>⚡</div>
          <div>Loading persisted execution records...</div>
        </div>
      ) : error ? (
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--accent-rose)',
            borderRadius: 'var(--radius-md)',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <div style={{ color: 'var(--accent-rose)', fontWeight: 700, marginBottom: '8px' }}>Events Unavailable</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>{error}</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-card)',
            borderRadius: 'var(--radius-lg)',
            padding: '60px 20px',
            textAlign: 'center',
            color: 'var(--text-muted)',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
            No Matching Events Found
          </div>
          <p style={{ fontSize: '13px', maxWidth: '480px', margin: '0 auto 20px auto' }}>
            No agent activities match the selected filters. Trigger an assessment or check a repository to generate real-time execution entries.
          </p>
          <button
            onClick={() => {
              setAgentFilter('all');
              setLevelFilter('all');
            }}
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredEvents.map((evt) => {
            const agentTheme = getAgentTheme(evt.agent);
            const levelBadge = getLevelBadge(evt.level);
            const dateObj = new Date(evt.timestamp);
            const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const formattedDate = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });

            return (
              <div
                key={evt.id}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 'var(--radius-md)',
                  padding: '18px 22px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '16px',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'border-color 0.2s ease, transform 0.15s ease',
                }}
              >
                {/* Left details */}
                <div style={{ flex: 1, minWidth: '280px' }}>
                  {/* Meta Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    {/* Agent Badge */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        backgroundColor: agentTheme.bg,
                        color: agentTheme.color,
                        border: `1px solid ${agentTheme.border}`,
                        padding: '3px 9px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 800,
                      }}
                    >
                      <span>{agentTheme.icon}</span>
                      <span>{evt.agent}</span>
                    </span>

                    {/* Level Badge */}
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        backgroundColor: levelBadge.bg,
                        color: levelBadge.color,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {levelBadge.label}
                    </span>

                    {/* Pinned Record ID */}
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-dim)',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    >
                      #{evt.id}
                    </span>

                    {/* Commit SHA badge if present */}
                    {evt.commit_sha && (
                      <span
                        style={{
                          fontSize: '11px',
                          backgroundColor: 'var(--bg-surface-elevated)',
                          color: 'var(--accent-primary)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 600,
                        }}
                      >
                        commit:{evt.commit_sha.slice(0, 7)}
                      </span>
                    )}

                    {/* Associated Track Title */}
                    {evt.track_title && (
                      <span
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-muted)',
                          maxWidth: '240px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        for <strong style={{ color: 'var(--text-main)' }}>{evt.track_title}</strong>
                      </span>
                    )}
                  </div>

                  {/* Message */}
                  <div style={{ fontSize: '14px', color: 'var(--text-main)', lineHeight: '1.5', fontWeight: 500 }}>
                    {evt.message}
                  </div>
                </div>

                {/* Right Actions & Timestamp */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', minWidth: '140px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)', textAlign: 'right' }}>
                    <div>{formattedTime}</div>
                    <div style={{ fontSize: '11px' }}>{formattedDate}</div>
                  </div>

                  {evt.track_id && (
                    <button
                      onClick={() => onNavigate(`/tracks/${evt.track_id}`)}
                      style={{
                        backgroundColor: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--accent-primary)',
                        padding: '5px 12px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span>View Track #{evt.track_id}</span>
                      <span>→</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
