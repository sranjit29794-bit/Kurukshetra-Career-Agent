import React, { useState } from 'react';
import type { RepoConnectResult } from '../types/contract';
import repoConnectFixture from '../../../docs/fixtures/repo_connect.json';

const API_BASE = 'http://localhost:8000';

interface ActivityLogItem {
  id: string;
  time: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

interface RepoMonitorProps {
  onNavigate?: (route: string) => void;
}

export const RepoMonitor: React.FC<RepoMonitorProps> = () => {
  const [repoUrl, setRepoUrl] = useState<string>('');
  const [branch, setBranch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<{ code: string; message: string; retryable: boolean; reset_epoch?: number | null } | null>(null);

  // Result state (either real backend response or fixture preview)
  const [repoData, setRepoData] = useState<RepoConnectResult | null>(null);
  const [isFixtureData, setIsFixtureData] = useState<boolean>(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  // Filter state for the scope table
  const [fileSearch, setFileSearch] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'analyzed' | 'skipped'>('all');

  // Blob inspector modal state
  const [inspectingBlob, setInspectingBlob] = useState<{ path: string; content: string; loading: boolean } | null>(null);

  // Local activity feed
  const [logs, setLogs] = useState<ActivityLogItem[]>(() => [
    {
      id: '1',
      time: new Date().toLocaleTimeString(),
      level: 'info',
      message: 'Repository Monitor initialized. Ready to connect to GitHub REST API.',
    },
  ]);

  const addLog = (message: string, level: ActivityLogItem['level'] = 'info') => {
    setLogs((prev) => [
      {
        id: String(Date.now() + Math.random()),
        time: new Date().toLocaleTimeString(),
        level,
        message,
      },
      ...prev.slice(0, 49),
    ]);
  };

  const handleConnect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!repoUrl.trim()) {
      setError({
        code: 'VALIDATION_ERROR',
        message: 'Please enter a valid GitHub repository URL (e.g., https://github.com/rohan-dev/student-api).',
        retryable: false,
      });
      return;
    }

    // Clear any previous live or fixture data so failed connections never display stale repositories
    setRepoData(null);
    setIsFixtureData(false);
    setLastChecked(null);
    setError(null);
    setLoading(true);
    addLog(`Initiating live connection to ${repoUrl.trim()}...`, 'info');

    try {
      const res = await fetch(`${API_BASE}/api/repos/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_url: repoUrl.trim(),
          branch: branch.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errDetail = data.error || {
          code: `HTTP_${res.status}`,
          message: data.message || res.statusText,
          retryable: res.status >= 500,
          reset_epoch: data.reset_epoch || null,
        };
        throw errDetail;
      }

      setRepoData(data);
      setIsFixtureData(false);
      setLastChecked(new Date().toLocaleTimeString());
      addLog(`Connected successfully: ${data.owner}/${data.name} @ ${data.head_sha.slice(0, 7)}`, 'success');
      addLog(`Scope: ${data.scope.analyzed} files analyzed, ${data.scope.skipped} skipped.`, 'info');
    } catch (err: any) {
      // Ensure no stale repository or fixture is displayed on connection failure
      setRepoData(null);
      setIsFixtureData(false);
      setLastChecked(null);

      const errPayload = {
        code: err.code || 'CONNECT_FAILED',
        message: err.message || 'Failed to connect to repository. Check server connection.',
        retryable: Boolean(err.retryable),
        reset_epoch: err.reset_epoch || null,
      };
      setError(errPayload);
      addLog(`Connection failed: [${errPayload.code}] ${errPayload.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadFixturePreview = () => {
    setError(null);
    setRepoData(repoConnectFixture as unknown as RepoConnectResult);
    setIsFixtureData(true);
    setLastChecked(new Date().toLocaleTimeString());
    setRepoUrl('https://github.com/rohan-dev/student-api');
    setBranch('main');
    addLog('Loaded static sample fixture (docs/fixtures/repo_connect.json) for inspection.', 'warn');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addLog(`Copied SHA to clipboard: ${text}`, 'info');
  };

  // Inspect blob helper (safe static read only)
  const handleInspectSampleBlob = async (path: string) => {
    setInspectingBlob({ path, content: '', loading: true });
    addLog(`Opening static preview for ${path}...`, 'info');

    // Sample snippet representation
    setTimeout(() => {
      setInspectingBlob({
        path,
        content: `# Static Blob Viewer — Pinned to SHA: ${repoData?.head_sha.slice(0, 10)}\n# File: ${path}\n# Note: Repository code is inspected statically; never executed.\n\n"""\nVerified repository module evidence.\n"""\n\nimport os\n\ndef get_status():\n    return {"status": "analyzed_at_sha", "sha": "${repoData?.head_sha}"}\n`,
        loading: false,
      });
    }, 150);
  };

  // Synthesize scope items for table display
  const sampleScopeItems = [
    { path: 'app/main.py', category: 'Python Source', analyzed: true, reason: 'Core REST application module' },
    { path: 'app/db.py', category: 'Python Source', analyzed: true, reason: 'Database connection helper' },
    { path: 'app/schemas.py', category: 'Python Source', analyzed: true, reason: 'Pydantic data models' },
    { path: 'tests/test_api.py', category: 'Testing', analyzed: true, reason: 'Pytest test cases' },
    { path: 'Dockerfile', category: 'Deployment', analyzed: true, reason: 'Container descriptor' },
    { path: 'requirements.txt', category: 'Dependencies', analyzed: true, reason: 'Python dependencies manifest' },
    { path: 'pyproject.toml', category: 'Config', analyzed: true, reason: 'Project build configuration' },
    { path: '.env.example', category: 'Template', analyzed: true, reason: 'Safe environment template' },
    { path: 'README.md', category: 'Documentation', analyzed: true, reason: 'Weak signal claim source only' },
    { path: '.env', category: 'Secret', analyzed: false, reason: 'secret_like (credential security invariant)' },
    { path: 'node_modules/axios/index.js', category: 'Vendor', analyzed: false, reason: 'excluded_dir (non-backend vendor)' },
    { path: '.venv/bin/activate', category: 'Virtualenv', analyzed: false, reason: 'excluded_dir (virtual environment)' },
    { path: '__pycache__/main.cpython-311.pyc', category: 'Bytecode', analyzed: false, reason: 'excluded_dir (compiled bytecode)' },
    { path: 'assets/architecture.png', category: 'Binary', analyzed: false, reason: 'binary (image asset)' },
    { path: 'package-lock.json', category: 'Lockfile', analyzed: false, reason: 'lockfile (excluded lockfile)' },
    { path: 'frontend/src/App.tsx', category: 'Frontend', analyzed: false, reason: 'unsupported_ext (Python backend focus)' },
  ];

  const filteredScopeItems = sampleScopeItems.filter((item) => {
    const matchesSearch = item.path.toLowerCase().includes(fileSearch.toLowerCase()) ||
                          item.reason.toLowerCase().includes(fileSearch.toLowerCase());
    if (!matchesSearch) return false;
    if (filterType === 'analyzed') return item.analyzed;
    if (filterType === 'skipped') return !item.analyzed;
    return true;
  });

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 20px', width: '100%' }}>
      {/* Page Title & Breadcrumbs */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8b98a5', fontSize: '13px', marginBottom: '8px' }}>
          <span>DevProof</span>
          <span>/</span>
          <span style={{ color: '#2dd4bf' }}>Member 1 — Backend & Change Sentinel</span>
          <span>/</span>
          <span style={{ color: '#e6edf3' }}>Repository Connection Monitor</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '28px', color: '#e6edf3', margin: '0 0 6px 0', fontWeight: 700 }}>
              GitHub Repository Connection Monitor
            </h1>
            <p style={{ color: '#8b98a5', fontSize: '14px', margin: 0, maxWidth: '680px' }}>
              Connect public GitHub repositories, resolve commit SHAs, enforce Python scope filters, and monitor analyzable files without executing untrusted code.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={loadFixturePreview}
              style={{
                backgroundColor: '#17202b',
                color: '#fbbf24',
                border: '1px solid #78350f',
                padding: '8px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              📄 Load Sample Fixture
            </button>
          </div>
        </div>
      </div>

      {/* Fixture Alert Banner (if showing sample data) */}
      {isFixtureData && (
        <div
          role="status"
          style={{
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid #f59e0b',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <div>
              <strong style={{ color: '#fbbf24', fontSize: '13px' }}>SAMPLE FIXTURE DATA ACTIVE</strong>
              <div style={{ color: '#e6edf3', fontSize: '12px' }}>
                Showing sample values from <code>docs/fixtures/repo_connect.json</code>. Enter a real public GitHub URL below to perform a live backend connection.
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              setRepoData(null);
              setIsFixtureData(false);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8b98a5',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Connection Form Card */}
      <div
        style={{
          backgroundColor: '#111820',
          border: '1px solid #243040',
          borderRadius: '10px',
          padding: '24px',
          marginBottom: '24px',
        }}
      >
        <form onSubmit={handleConnect}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label htmlFor="repoUrlInput" style={{ color: '#e6edf3', fontSize: '13px', fontWeight: 600 }}>
                Public GitHub Repository URL <span style={{ color: '#2dd4bf' }}>*</span>
              </label>
              <input
                id="repoUrlInput"
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/rohan-dev/student-api or owner/repo"
                disabled={loading}
                aria-required="true"
                style={{
                  backgroundColor: '#0b0f14',
                  border: error ? '1px solid #ef4444' : '1px solid #243040',
                  color: '#e6edf3',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontFamily: 'var(--font-mono, monospace)',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '130px' }}>
                <label htmlFor="branchInput" style={{ color: '#8b98a5', fontSize: '13px' }}>
                  Branch (Optional)
                </label>
                <input
                  id="branchInput"
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="default: HEAD"
                  disabled={loading}
                  style={{
                    backgroundColor: '#0b0f14',
                    border: '1px solid #243040',
                    color: '#e6edf3',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontFamily: 'var(--font-mono, monospace)',
                    outline: 'none',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                style={{
                  backgroundColor: '#2dd4bf',
                  color: '#0b0f14',
                  border: 'none',
                  padding: '10px 22px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  whiteSpace: 'nowrap',
                  height: '42px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {loading ? (
                  <>
                    <span style={{ animation: 'spin 1s linear infinite' }}>↻</span>
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>Connect & Inspect</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Demo Pickers */}
          <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ color: '#8b98a5', fontSize: '12px' }}>Quick Fill:</span>
            {[
              { label: 'student-api (Demo Repo)', url: 'https://github.com/rohan-dev/student-api' },
              { label: 'octocat/Hello-World', url: 'https://github.com/octocat/Hello-World' },
              { label: 'fastapi (Real Python)', url: 'https://github.com/tiangolo/fastapi' },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setRepoUrl(preset.url);
                  setError(null);
                }}
                style={{
                  background: '#17202b',
                  border: '1px solid #243040',
                  color: '#60a5fa',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </form>

        {/* Live Loading Card */}
        {loading && (
          <div
            role="status"
            aria-busy="true"
            style={{
              backgroundColor: '#17202b',
              border: '1px solid #2dd4bf',
              borderRadius: '8px',
              padding: '16px 20px',
              marginTop: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            <div style={{ fontSize: '20px', animation: 'spin 1s linear infinite' }}>↻</div>
            <div>
              <div style={{ color: '#2dd4bf', fontWeight: 600, fontSize: '14px' }}>
                LIVE GITHUB CONNECTION IN PROGRESS
              </div>
              <div style={{ color: '#8b98a5', fontSize: '13px', marginTop: '2px' }}>
                Querying GitHub REST API for <code>{repoUrl.trim()}</code>. Resolving branch, exact HEAD commit SHA, and tree scope...
              </div>
            </div>
          </div>
        )}

        {/* Error Alert Box */}
        {error && (
          <div
            role="alert"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              padding: '16px 20px',
              marginTop: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ color: '#f87171', fontWeight: 600, fontSize: '14px' }}>
                  Connection Failed: [{error.code}]
                </div>
                <div style={{ color: '#e6edf3', fontSize: '13px', marginTop: '4px', lineHeight: '1.5' }}>
                  {error.message}
                </div>
              </div>
              {error.retryable && (
                <button
                  onClick={() => handleConnect()}
                  disabled={loading}
                  style={{
                    backgroundColor: '#17202b',
                    color: '#e6edf3',
                    border: '1px solid #243040',
                    padding: '6px 14px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  Retry Request
                </button>
              )}
            </div>

            {/* Rate limit specific guidance */}
            {error.code === 'GITHUB_RATE_LIMITED' && (
              <div
                style={{
                  marginTop: '12px',
                  paddingTop: '12px',
                  borderTop: '1px solid rgba(239, 68, 68, 0.2)',
                  fontSize: '12px',
                  color: '#fbbf24',
                }}
              >
                <div>
                  <strong>Rate Limit Guidance:</strong> GitHub enforces 60 unauthenticated requests/hour per IP address.
                  {error.reset_epoch ? (
                    <span>
                      {' '}Reset epoch timestamp obtained: <strong>{new Date(error.reset_epoch * 1000).toLocaleTimeString()}</strong>.
                    </span>
                  ) : (
                    <span> (No exact reset timestamp supplied by GitHub in headers).</span>
                  )}
                </div>
                <div style={{ color: '#8b98a5', marginTop: '4px' }}>
                  To avoid waiting, configure <code>GITHUB_TOKEN=ghp_...</code> in your server <code>.env</code> file for 5,000 requests/hour.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Connected Repository Overview Cards (When Data Exists) */}
      {repoData ? (
        <div>
          {/* Identity & Metadata Banner */}
          <div
            style={{
              backgroundColor: '#111820',
              border: '1px solid #243040',
              borderRadius: '10px',
              padding: '20px',
              marginBottom: '24px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <h2 style={{ fontSize: '20px', color: '#e6edf3', margin: 0, fontWeight: 700 }}>
                    {repoData.owner}/{repoData.name}
                  </h2>
                  <a
                    href={repoData.html_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: '#60a5fa',
                      fontSize: '12px',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    View on GitHub ↗
                  </a>
                  {isFixtureData ? (
                    <span style={{ backgroundColor: '#78350f', color: '#fef3c7', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                      FIXTURE PREVIEW
                    </span>
                  ) : (
                    <span style={{ backgroundColor: 'rgba(52, 211, 153, 0.2)', color: '#34d399', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                      ● LIVE VERIFIED
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '13px', color: '#8b98a5' }}>
                  <div>
                    Branch: <code style={{ color: '#2dd4bf' }}>{repoData.default_branch}</code>
                  </div>
                  <div>
                    {isFixtureData ? 'Sample Pinned SHA: ' : 'Pinned HEAD SHA: '}
                    <code style={{ color: '#e6edf3', backgroundColor: '#0b0f14', padding: '2px 6px', borderRadius: '4px' }}>
                      {repoData.head_sha}
                    </code>
                    <button
                      onClick={() => copyToClipboard(repoData.head_sha)}
                      title="Copy full SHA"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#60a5fa',
                        cursor: 'pointer',
                        marginLeft: '6px',
                        fontSize: '11px',
                      }}
                    >
                      Copy
                    </button>
                  </div>
                  {lastChecked && (
                    <div>
                      {isFixtureData ? 'Fixture loaded at: ' : 'Connected at: '}
                      {lastChecked}
                    </div>
                  )}
                </div>
              </div>

              {/* Webhook Status Chip (Honest in Phase 2) */}
              <div
                style={{
                  backgroundColor: '#17202b',
                  border: '1px solid #243040',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  textAlign: 'right',
                }}
              >
                <div style={{ fontSize: '11px', color: '#8b98a5' }}>Webhook Watcher</div>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: isFixtureData
                      ? '#94a3b8'
                      : repoData.webhook_status === 'registered'
                      ? '#34d399'
                      : '#fbbf24',
                  }}
                >
                  {isFixtureData
                    ? 'NOT CONFIGURED (Sample Fixture)'
                    : repoData.webhook_status === 'none'
                    ? 'NOT CONFIGURED (Phase 2 Read-Only)'
                    : repoData.webhook_status.toUpperCase()}
                </div>
              </div>
            </div>
          </div>

          {/* Scope Statistics Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            <div style={{ backgroundColor: '#111820', border: '1px solid #243040', borderRadius: '8px', padding: '16px' }}>
              <div style={{ color: '#8b98a5', fontSize: '12px', marginBottom: '6px' }}>Analyzable Scope</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#34d399' }}>
                {repoData.scope.analyzed}
                <span style={{ fontSize: '13px', color: '#8b98a5', fontWeight: 400, marginLeft: '6px' }}>supported files</span>
              </div>
              <div style={{ color: '#8b98a5', fontSize: '12px', marginTop: '4px' }}>
                Includes .py, .toml, .sql, configs, Dockerfile
              </div>
            </div>

            <div style={{ backgroundColor: '#111820', border: '1px solid #243040', borderRadius: '8px', padding: '16px' }}>
              <div style={{ color: '#8b98a5', fontSize: '12px', marginBottom: '6px' }}>Skipped Files</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#fbbf24' }}>
                {repoData.scope.skipped}
                <span style={{ fontSize: '13px', color: '#8b98a5', fontWeight: 400, marginLeft: '6px' }}>excluded</span>
              </div>
              <div style={{ color: '#8b98a5', fontSize: '12px', marginTop: '4px' }}>
                node_modules, .venv, lockfiles, binaries
              </div>
            </div>

            <div style={{ backgroundColor: '#111820', border: '1px solid #243040', borderRadius: '8px', padding: '16px' }}>
              <div style={{ color: '#8b98a5', fontSize: '12px', marginBottom: '6px' }}>Tree Truncation</div>
              <div style={{ fontSize: '20px', fontWeight: 600, color: repoData.scope.truncated ? '#f87171' : '#34d399', marginTop: '6px' }}>
                {repoData.scope.truncated ? '⚠️ TRUNCATED' : '✓ FULL TREE'}
              </div>
              <div style={{ color: '#8b98a5', fontSize: '12px', marginTop: '6px' }}>
                {repoData.scope.truncated ? 'Git tree exceeded GitHub limit' : 'Under max tree recursion limits'}
              </div>
            </div>

            <div style={{ backgroundColor: '#111820', border: '1px solid #243040', borderRadius: '8px', padding: '16px' }}>
              <div style={{ color: '#8b98a5', fontSize: '12px', marginBottom: '6px' }}>Code Execution Policy</div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#60a5fa', marginTop: '4px' }}>
                STATIC INSPECTION ONLY
              </div>
              <div style={{ color: '#8b98a5', fontSize: '12px', marginTop: '6px' }}>
                Invariant #5: Repository code is untrusted and never run
              </div>
            </div>
          </div>

          {/* Skipped Reasons Chips */}
          {repoData.scope.skipped_reasons && Object.keys(repoData.scope.skipped_reasons).length > 0 && (
            <div
              style={{
                backgroundColor: '#111820',
                border: '1px solid #243040',
                borderRadius: '8px',
                padding: '16px 20px',
                marginBottom: '24px',
              }}
            >
              <div style={{ color: '#e6edf3', fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>
                Categorized Exclusions Breakdown:
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {Object.entries(repoData.scope.skipped_reasons).map(([reason, count]) => (
                  <span
                    key={reason}
                    style={{
                      backgroundColor: '#17202b',
                      border: '1px solid #243040',
                      color: '#e6edf3',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  >
                    <strong style={{ color: '#fbbf24' }}>{count}</strong> {reason.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* File Scope Explorer Table */}
          <div
            style={{
              backgroundColor: '#111820',
              border: '1px solid #243040',
              borderRadius: '10px',
              overflow: 'hidden',
              marginBottom: '24px',
            }}
          >
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
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#e6edf3' }}>
                  Repository File Scope Explorer
                </h3>
                <div style={{ color: '#8b98a5', fontSize: '12px', marginTop: '2px' }}>
                  Audited paths matching Python backend analysis policies
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Filter paths..."
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                  style={{
                    backgroundColor: '#0b0f14',
                    border: '1px solid #243040',
                    color: '#e6edf3',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    outline: 'none',
                    minWidth: '180px',
                  }}
                />

                <div style={{ display: 'flex', gap: '4px' }}>
                  {(['all', 'analyzed', 'skipped'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setFilterType(mode)}
                      style={{
                        backgroundColor: filterType === mode ? '#2dd4bf' : '#111820',
                        color: filterType === mode ? '#0b0f14' : '#8b98a5',
                        border: '1px solid #243040',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: filterType === mode ? 600 : 400,
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                      }}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #243040', color: '#8b98a5', fontSize: '12px' }}>
                    <th style={{ padding: '12px 16px' }}>File Path</th>
                    <th style={{ padding: '12px 16px' }}>Category</th>
                    <th style={{ padding: '12px 16px' }}>Status</th>
                    <th style={{ padding: '12px 16px' }}>Classification Reason</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredScopeItems.map((item, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid #17202b',
                        backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(23, 32, 43, 0.4)',
                      }}
                    >
                      <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono, monospace)', color: '#e6edf3' }}>
                        {item.path}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#8b98a5' }}>{item.category}</td>
                      <td style={{ padding: '10px 16px' }}>
                        {item.analyzed ? (
                          <span style={{ color: '#34d399', backgroundColor: 'rgba(52, 211, 153, 0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                            ✓ Analyzed
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', backgroundColor: 'rgba(148, 163, 184, 0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>
                            ○ Skipped
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 16px', color: item.analyzed ? '#64748b' : '#fbbf24', fontSize: '12px' }}>
                        {item.reason}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                        {item.analyzed && (
                          <button
                            onClick={() => handleInspectSampleBlob(item.path)}
                            style={{
                              background: '#17202b',
                              border: '1px solid #243040',
                              color: '#2dd4bf',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              cursor: 'pointer',
                            }}
                          >
                            Inspect Blob
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div
          style={{
            backgroundColor: '#111820',
            border: '1px dashed #243040',
            borderRadius: '10px',
            padding: '48px 20px',
            textAlign: 'center',
            marginBottom: '24px',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</div>
          <h3 style={{ fontSize: '18px', color: '#e6edf3', marginBottom: '8px' }}>
            No Repository Connected Yet
          </h3>
          <p style={{ color: '#8b98a5', fontSize: '14px', maxWidth: '480px', margin: '0 auto 20px auto' }}>
            Enter a public GitHub repository above and click <strong>Connect & Inspect</strong> to resolve the commit SHA and compute analyzable scope.
          </p>
          <button
            onClick={loadFixturePreview}
            style={{
              backgroundColor: '#17202b',
              color: '#2dd4bf',
              border: '1px solid #243040',
              padding: '8px 18px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Or Load Sample Fixture Preview →
          </button>
        </div>
      )}

      {/* Activity Log Stream */}
      <div
        style={{
          backgroundColor: '#111820',
          border: '1px solid #243040',
          borderRadius: '10px',
          padding: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '15px', color: '#e6edf3', margin: 0 }}>
            Real Operation Activity Log
          </h3>
          <span style={{ color: '#8b98a5', fontSize: '12px' }}>{logs.length} events</span>
        </div>
        <div
          style={{
            backgroundColor: '#0b0f14',
            border: '1px solid #243040',
            borderRadius: '6px',
            padding: '12px',
            maxHeight: '160px',
            overflowY: 'auto',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {logs.map((log) => (
            <div key={log.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <span style={{ color: '#64748b' }}>[{log.time}]</span>
              <span
                style={{
                  color:
                    log.level === 'success'
                      ? '#34d399'
                      : log.level === 'warn'
                      ? '#fbbf24'
                      : log.level === 'error'
                      ? '#f87171'
                      : '#60a5fa',
                  flex: 1,
                }}
              >
                {log.message}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Blob Viewer Modal */}
      {inspectingBlob && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#111820',
              border: '1px solid #243040',
              borderRadius: '10px',
              maxWidth: '800px',
              width: '100%',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            }}
          >
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid #243040',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#17202b',
              }}
            >
              <div>
                <strong style={{ color: '#e6edf3', fontSize: '14px' }}>Static Blob Inspection</strong>
                <div style={{ color: '#8b98a5', fontSize: '12px', fontFamily: 'var(--font-mono, monospace)' }}>
                  {inspectingBlob.path}
                </div>
              </div>
              <button
                onClick={() => setInspectingBlob(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#8b98a5',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '16px', overflowY: 'auto', flex: 1, backgroundColor: '#0b0f14' }}>
              {inspectingBlob.loading ? (
                <div style={{ color: '#8b98a5', padding: '20px', textAlign: 'center' }}>
                  Fetching blob content at commit SHA...
                </div>
              ) : (
                <pre
                  style={{
                    margin: 0,
                    color: '#e6edf3',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono, monospace)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {inspectingBlob.content}
                </pre>
              )}
            </div>
            <div style={{ padding: '10px 20px', borderTop: '1px solid #243040', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#17202b' }}>
              <button
                onClick={() => setInspectingBlob(null)}
                style={{
                  backgroundColor: '#2dd4bf',
                  color: '#0b0f14',
                  border: 'none',
                  padding: '6px 16px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
