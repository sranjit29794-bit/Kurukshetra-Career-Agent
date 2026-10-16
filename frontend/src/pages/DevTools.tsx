import { useEffect, useState } from 'react';
import type {
  AnalysisDetail,
  DiffResponse,
  HealthResponse,
  JobDraft,
  RepoConnectResult,
  AgentEvent,
} from '../types/contract';

// Static fixture fallbacks
import jobDraftFixture from '../../../docs/fixtures/job_draft.json';
import repoConnectFixture from '../../../docs/fixtures/repo_connect.json';
import assessmentFixture from '../../../docs/fixtures/assessment.json';
import diffFixture from '../../../docs/fixtures/diff.json';
import agentEventsFixture from '../../../docs/fixtures/agent_events.json';

const API_BASE = import.meta.env.VITE_API_BASE || '';

export const DevTools: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [contractsCheck, setContractsCheck] = useState<{
    valid: boolean;
    data?: any;
    error?: string;
  } | null>(null);
  const [contractsLoading, setContractsLoading] = useState<boolean>(true);

  const [activeTab, setActiveTab] = useState<'assessment' | 'diff' | 'job' | 'repo' | 'events' | 'raw'>(
    'assessment'
  );

  // Fixture states
  const assessmentData = assessmentFixture as unknown as AnalysisDetail;
  const diffData = diffFixture as unknown as DiffResponse;
  const jobDraftData = jobDraftFixture as unknown as JobDraft;
  const repoConnectData = repoConnectFixture as unknown as RepoConnectResult;
  const agentEventsData = agentEventsFixture as unknown as AgentEvent[];

  const fetchHealth = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
      }
      const data: HealthResponse = await res.json();
      setHealth(data);
    } catch (err: any) {
      setHealthError(err.message || 'Failed to connect to backend');
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  };

  const fetchContracts = async () => {
    setContractsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/dev/contracts`);
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      setContractsCheck({ valid: data.contracts_valid === true, data });
    } catch (err: any) {
      setContractsCheck({
        valid: false,
        error: err.message || 'Failed to validate contracts with backend',
      });
    } finally {
      setContractsLoading(false);
    }
  };

  const refreshAll = () => {
    fetchHealth();
    fetchContracts();
  };

  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/health`);
        if (!res.ok) throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
        const data: HealthResponse = await res.json();
        if (isMounted) {
          setHealth(data);
          setHealthError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          setHealthError(err.message || 'Failed to connect to backend');
          setHealth(null);
        }
      } finally {
        if (isMounted) setHealthLoading(false);
      }

      try {
        const res = await fetch(`${API_BASE}/api/dev/contracts`);
        if (!res.ok) throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
        const data = await res.json();
        if (isMounted) {
          setContractsCheck({ valid: data.contracts_valid === true, data });
        }
      } catch (err: any) {
        if (isMounted) {
          setContractsCheck({
            valid: false,
            error: err.message || 'Failed to validate contracts with backend',
          });
        }
      } finally {
        if (isMounted) setContractsLoading(false);
      }
    };

    loadInitialData();
    return () => {
      isMounted = false;
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DEMONSTRATED':
        return { bg: 'rgba(52, 211, 153, 0.15)', text: '#34D399', border: '#34D399' };
      case 'PARTIAL':
        return { bg: 'rgba(251, 191, 36, 0.15)', text: '#FBBF24', border: '#FBBF24' };
      case 'NOT_DEMONSTRATED':
        return { bg: 'rgba(148, 163, 184, 0.15)', text: '#94A3B8', border: '#94A3B8' };
      case 'UNABLE_TO_ASSESS':
        return { bg: 'rgba(167, 139, 250, 0.15)', text: '#A78BFA', border: '#A78BFA' };
      default:
        return { bg: 'rgba(139, 152, 165, 0.15)', text: '#8B98A5', border: '#8B98A5' };
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px', width: '100%' }}>
      {/* Dev Warning Banner */}
      <div
        style={{
          backgroundColor: '#1c1917',
          border: '1px solid #78350f',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <span style={{ color: '#f59e0b', fontWeight: 600, marginRight: '8px' }}>
            🛠️ DEVELOPER TOOLS & VERIFICATION SCREEN
          </span>
          <span style={{ color: '#d6d3d1', fontSize: '13px' }}>
            Phase 0 contract & schema test harness. Not the end-user product dashboard.
          </span>
        </div>
        <span
          style={{
            backgroundColor: '#78350f',
            color: '#fef3c7',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.5px',
          }}
        >
          PHASE 0 ONLY
        </span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '28px', color: '#e6edf3', marginBottom: '8px' }}>
          DevProof <span style={{ color: '#2dd4bf' }}>// Shared Foundation</span>
        </h1>
        <p style={{ color: '#8b98a5', fontSize: '14px' }}>
          Real backend connectivity verification and typed contract inspection for Members 1–4.
        </p>
      </div>

      {/* Backend Health Check Card */}
      <div
        style={{
          backgroundColor: '#111820',
          border: '1px solid #243040',
          borderRadius: '10px',
          padding: '20px',
          marginBottom: '32px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: health?.backend === 'ok' ? '#34d399' : '#f87171',
                boxShadow:
                  health?.backend === 'ok' ? '0 0 8px #34d399' : '0 0 8px #f87171',
              }}
            />
            <h2 style={{ fontSize: '18px', color: '#e6edf3', margin: 0 }}>
              Live Backend Connectivity (GET /api/health)
            </h2>
          </div>
          <button
            onClick={refreshAll}
            disabled={healthLoading || contractsLoading}
            style={{
              backgroundColor: '#17202b',
              color: '#e6edf3',
              border: '1px solid #243040',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '13px',
              cursor: healthLoading || contractsLoading ? 'not-allowed' : 'pointer',
              fontWeight: 500,
            }}
          >
            {healthLoading || contractsLoading ? 'Checking...' : '↻ Refresh Status'}
          </button>
        </div>

        {healthError ? (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              padding: '12px',
              color: '#f87171',
              fontSize: '13px',
            }}
          >
            <strong>Backend Connection Failed:</strong> {healthError}
            <div style={{ marginTop: '6px', color: '#8b98a5', fontSize: '12px' }}>
              Ensure backend is running: <code>uvicorn backend.app.main:app --port 8000</code>
            </div>
          </div>
        ) : health ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
            }}
          >
            <div
              style={{
                backgroundColor: '#17202b',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid #243040',
              }}
            >
              <div style={{ color: '#8b98a5', fontSize: '12px' }}>Backend API</div>
              <div style={{ color: '#34d399', fontWeight: 600, fontSize: '15px' }}>
                ONLINE ({health.backend})
              </div>
            </div>
            <div
              style={{
                backgroundColor: '#17202b',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid #243040',
              }}
            >
              <div style={{ color: '#8b98a5', fontSize: '12px' }}>LLM Engine</div>
              <div
                style={{
                  color: health.llm === 'ok' ? '#34d399' : '#fbbf24',
                  fontWeight: 600,
                  fontSize: '15px',
                }}
              >
                {health.llm.toUpperCase()}
              </div>
            </div>
            <div
              style={{
                backgroundColor: '#17202b',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid #243040',
              }}
            >
              <div style={{ color: '#8b98a5', fontSize: '12px' }}>GitHub Integration</div>
              <div
                style={{
                  color: health.github === 'ok' ? '#34d399' : '#94a3b8',
                  fontWeight: 600,
                  fontSize: '15px',
                }}
              >
                {health.github.toUpperCase()}
                {health.github_rate_remaining !== null &&
                  ` (${health.github_rate_remaining} reqs)`}
              </div>
            </div>
            <div
              style={{
                backgroundColor: '#17202b',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid #243040',
              }}
            >
              <div style={{ color: '#8b98a5', fontSize: '12px' }}>Change Watcher</div>
              <div
                style={{
                  color: health.watcher === 'unconfigured' ? '#94a3b8' : '#2dd4bf',
                  fontWeight: 600,
                  fontSize: '15px',
                }}
              >
                {health.watcher.toUpperCase()}
                {health.next_poll_in_s ? ` (every ${health.next_poll_in_s}s)` : ''}
              </div>
            </div>
            <div
              style={{
                backgroundColor: '#17202b',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid #243040',
              }}
            >
              <div style={{ color: '#8b98a5', fontSize: '12px' }}>Pydantic Contracts</div>
              <div
                style={{
                  color:
                    contractsCheck?.valid
                      ? '#34d399'
                      : contractsLoading
                      ? '#94a3b8'
                      : '#f87171',
                  fontWeight: 600,
                  fontSize: '15px',
                }}
              >
                {contractsLoading
                  ? 'CHECKING...'
                  : contractsCheck?.valid
                  ? 'VERIFIED (5/5)'
                  : 'ERROR'}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ color: '#8b98a5', fontSize: '13px' }}>Checking backend health...</div>
        )}
      </div>

      {/* Contract Verification Panels */}
      <div
        style={{
          backgroundColor: '#111820',
          border: '1px solid #243040',
          borderRadius: '10px',
          overflow: 'hidden',
        }}
      >
        {/* Panel Header with Tabs and MOCK DATA disclaimer */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #243040',
            backgroundColor: '#17202b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['assessment', 'diff', 'job', 'repo', 'events', 'raw'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  backgroundColor: activeTab === tab ? '#2dd4bf' : '#111820',
                  color: activeTab === tab ? '#0b0f14' : '#e6edf3',
                  border: '1px solid #243040',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: activeTab === tab ? 600 : 400,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {tab === 'raw' ? 'Raw Contracts' : tab}
              </button>
            ))}
          </div>

          <div
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid #f59e0b',
              color: '#f59e0b',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.5px',
            }}
          >
            FIXTURE / MOCK DATA (docs/fixtures)
          </div>
        </div>

        {/* Panel Content */}
        <div style={{ padding: '24px' }}>
          {/* TAB 1: Assessment */}
          {activeTab === 'assessment' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                  borderBottom: '1px solid #243040',
                  paddingBottom: '12px',
                }}
              >
                <div>
                  <h3 style={{ fontSize: '18px', color: '#e6edf3' }}>
                    Initial Assessment Snapshot
                  </h3>
                  <div style={{ color: '#8b98a5', fontSize: '12px', marginTop: '4px' }}>
                    Commit:{' '}
                    <code style={{ color: '#2dd4bf' }}>{assessmentData.commit_sha}</code> ·
                    Status: <span style={{ color: '#34d399' }}>{assessmentData.status}</span> ·
                    Scope: {assessmentData.scope?.analyzed ?? 0} files analyzed
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {assessmentData.assessments.map((item) => {
                  const style = getStatusColor(item.status);
                  return (
                    <div
                      key={item.id}
                      style={{
                        backgroundColor: '#17202b',
                        border: '1px solid #243040',
                        borderRadius: '8px',
                        padding: '16px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '8px',
                        }}
                      >
                        <span style={{ fontWeight: 600, fontSize: '16px', color: '#e6edf3' }}>
                          {item.requirement_name}
                        </span>
                        <span
                          style={{
                            backgroundColor: style.bg,
                            color: style.text,
                            border: `1px solid ${style.border}`,
                            padding: '2px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          {item.status} ({item.strength})
                        </span>
                      </div>
                      <p style={{ color: '#e6edf3', fontSize: '14px', marginBottom: '8px' }}>
                        {item.summary}
                      </p>

                      {item.limitation && (
                        <div
                          style={{
                            backgroundColor: 'rgba(251, 191, 36, 0.1)',
                            borderLeft: '3px solid #fbbf24',
                            padding: '6px 10px',
                            fontSize: '12px',
                            color: '#fbbf24',
                            marginBottom: '6px',
                          }}
                        >
                          <strong>Limitation:</strong> {item.limitation}
                        </div>
                      )}

                      {item.next_step && (
                        <div
                          style={{
                            backgroundColor: 'rgba(45, 212, 191, 0.1)',
                            borderLeft: '3px solid #2dd4bf',
                            padding: '6px 10px',
                            fontSize: '12px',
                            color: '#2dd4bf',
                            marginBottom: '6px',
                          }}
                        >
                          <strong>Next Step:</strong> {item.next_step}
                        </div>
                      )}

                      {item.evidence && item.evidence.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ fontSize: '12px', color: '#8b98a5', marginBottom: '4px' }}>
                            Evidence Citations:
                          </div>
                          {item.evidence.map((ev, i) => (
                            <div
                              key={i}
                              style={{
                                backgroundColor: '#111820',
                                border: '1px solid #243040',
                                borderRadius: '4px',
                                padding: '8px',
                                fontSize: '12px',
                                fontFamily: 'var(--font-mono)',
                              }}
                            >
                              <div style={{ color: '#60a5fa', marginBottom: '4px' }}>
                                {ev.file_path} (L{ev.line_start}–{ev.line_end}) [{ev.detector}]
                              </div>
                              <pre
                                style={{
                                  color: '#e6edf3',
                                  fontSize: '11px',
                                  overflowX: 'auto',
                                  whiteSpace: 'pre-wrap',
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
            </div>
          )}

          {/* TAB 2: Diff / Change Set */}
          {activeTab === 'diff' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                  borderBottom: '1px solid #243040',
                  paddingBottom: '12px',
                }}
              >
                <div>
                  <h3 style={{ fontSize: '18px', color: '#e6edf3' }}>
                    Reassessment Diff (Commit C2 Push)
                  </h3>
                  <div style={{ color: '#8b98a5', fontSize: '12px', marginTop: '4px' }}>
                    <span>
                      {diffData.from_sha.slice(0, 7)} →{' '}
                      <span style={{ color: '#2dd4bf' }}>{diffData.to_sha.slice(0, 7)}</span>
                    </span>{' '}
                    · {diffData.commit_message}
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#8b98a5', textAlign: 'right' }}>
                  <div>Reassessed: {diffData.reassessed_count} skills</div>
                  <div>Carried forward: {diffData.carried_forward_count} skills</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {diffData.items.map((item) => (
                  <div
                    key={item.requirement_id}
                    style={{
                      backgroundColor: '#17202b',
                      border:
                        item.change === 'improved' ? '1px solid #34d399' : '1px solid #243040',
                      borderRadius: '8px',
                      padding: '16px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '8px',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: '#e6edf3' }}>{item.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                          {item.before_status || 'NONE'}
                        </span>
                        <span style={{ color: '#8b98a5' }}>→</span>
                        <span
                          style={{
                            color: getStatusColor(item.after_status).text,
                            fontWeight: 600,
                            fontSize: '12px',
                          }}
                        >
                          {item.after_status}
                        </span>
                        <span
                          style={{
                            backgroundColor:
                              item.change === 'improved'
                                ? 'rgba(52, 211, 153, 0.2)'
                                : 'rgba(148, 163, 184, 0.2)',
                            color: item.change === 'improved' ? '#34d399' : '#94a3b8',
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 600,
                          }}
                        >
                          {item.change.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    {item.why && (
                      <p style={{ color: '#e6edf3', fontSize: '13px', marginBottom: '6px' }}>
                        {item.why}
                      </p>
                    )}
                    {item.remaining_limitation && (
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#fbbf24',
                          backgroundColor: 'rgba(251, 191, 36, 0.1)',
                          padding: '6px',
                          borderRadius: '4px',
                        }}
                      >
                        Limitation: {item.remaining_limitation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Job Draft */}
          {activeTab === 'job' && (
            <div>
              <h3 style={{ fontSize: '18px', color: '#e6edf3', marginBottom: '8px' }}>
                Job Draft Schema
              </h3>
              <p style={{ color: '#8b98a5', fontSize: '13px', marginBottom: '16px' }}>
                {jobDraftData.title} @ {jobDraftData.company} ({jobDraftData.source_type})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {jobDraftData.requirements.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      backgroundColor: '#17202b',
                      padding: '12px',
                      borderRadius: '6px',
                      border: '1px solid #243040',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '4px',
                      }}
                    >
                      <strong style={{ color: '#e6edf3' }}>{req.name}</strong>
                      <span
                        style={{
                          color: req.priority === 'must' ? '#f87171' : '#60a5fa',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}
                      >
                        {req.priority.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ color: '#8b98a5', fontSize: '12px', marginBottom: '4px' }}>
                      Category: {req.category} · Taxonomy: {req.taxonomy_key || 'None'}
                    </div>
                    <div style={{ color: '#e6edf3', fontSize: '13px', fontStyle: 'italic' }}>
                      "{req.source_sentence}"
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: Repo Connect */}
          {activeTab === 'repo' && (
            <div>
              <h3 style={{ fontSize: '18px', color: '#e6edf3', marginBottom: '8px' }}>
                Repository Connection Result
              </h3>
              <div
                style={{
                  backgroundColor: '#17202b',
                  padding: '16px',
                  borderRadius: '6px',
                  border: '1px solid #243040',
                }}
              >
                <p style={{ color: '#e6edf3', marginBottom: '8px' }}>
                  <strong>Repository:</strong> {repoConnectData.owner}/{repoConnectData.name}
                </p>
                <p style={{ color: '#8b98a5', fontSize: '13px', marginBottom: '4px' }}>
                  Branch: <code>{repoConnectData.default_branch}</code> · SHA:{' '}
                  <code>{repoConnectData.head_sha}</code>
                </p>
                <p style={{ color: '#8b98a5', fontSize: '13px', marginBottom: '8px' }}>
                  Webhook Status: <strong>{repoConnectData.webhook_status}</strong>
                </p>
                <div style={{ marginTop: '12px' }}>
                  <strong style={{ color: '#e6edf3', fontSize: '13px' }}>Scope Summary:</strong>
                  <div style={{ color: '#8b98a5', fontSize: '12px', marginTop: '4px' }}>
                    Analyzed files: {repoConnectData.scope.analyzed} · Skipped files:{' '}
                    {repoConnectData.scope.skipped}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Agent Events */}
          {activeTab === 'events' && (
            <div>
              <h3 style={{ fontSize: '18px', color: '#e6edf3', marginBottom: '8px' }}>
                Agent Activity Feed Stream
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {agentEventsData.map((ev) => (
                  <div
                    key={ev.id}
                    style={{
                      backgroundColor: '#17202b',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      border: '1px solid #243040',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <span
                      style={{
                        backgroundColor: '#111820',
                        color: '#2dd4bf',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}
                    >
                      {ev.agent}
                    </span>
                    <span
                      style={{
                        color:
                          ev.level === 'warn'
                            ? '#fbbf24'
                            : ev.level === 'success'
                            ? '#34d399'
                            : '#e6edf3',
                        fontSize: '13px',
                        flex: 1,
                      }}
                    >
                      {ev.message}
                    </span>
                    <span style={{ color: '#8b98a5', fontSize: '11px' }}>
                      {new Date(ev.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: Raw JSON */}
          {activeTab === 'raw' && (
            <div>
              <h3 style={{ fontSize: '18px', color: '#e6edf3', marginBottom: '8px' }}>
                Raw Contract Schemas & Fixtures
              </h3>
              <pre
                style={{
                  backgroundColor: '#0b0f14',
                  border: '1px solid #243040',
                  borderRadius: '6px',
                  padding: '16px',
                  color: '#e6edf3',
                  fontSize: '12px',
                  overflowX: 'auto',
                  maxHeight: '500px',
                }}
              >
                {JSON.stringify(
                  {
                    health,
                    backendContractsValidation: contractsCheck,
                    fixtures: {
                      jobDraft: jobDraftData,
                      repoConnect: repoConnectData,
                      assessment: assessmentData,
                      diff: diffData,
                      agentEvents: agentEventsData,
                    },
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: '32px',
          textAlign: 'center',
          color: '#8b98a5',
          fontSize: '12px',
          display: 'flex',
          justifyContent: 'center',
          gap: '24px',
        }}
      >
        <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer">
          Swagger / OpenAPI Docs ↗
        </a>
        <a href="http://localhost:8000/api/health" target="_blank" rel="noreferrer">
          Raw /api/health Endpoint ↗
        </a>
        <a href="http://localhost:8000/api/dev/contracts" target="_blank" rel="noreferrer">
          Raw /api/dev/contracts Endpoint ↗
        </a>
      </div>
    </div>
  );
};
