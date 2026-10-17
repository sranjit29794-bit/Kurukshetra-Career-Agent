import { useState, useEffect } from 'react';
import { Dashboard } from './pages/Dashboard';
import { CareerTrack } from './pages/CareerTrack';
import { TrackDetailView } from './pages/TrackDetailView';
import { DiffView } from './pages/DiffView';
import { RepoMonitor } from './pages/RepoMonitor';
import { Settings } from './pages/Settings';
import { DevTools } from './pages/DevTools';
import { ActivityFeedView } from './pages/ActivityFeedView';
import { API_BASE } from './api/config';
import type { HealthResponse } from './types/contract';

export function App() {
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('devproof_theme') as 'light' | 'dark') || 'light';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [trackCount, setTrackCount] = useState<number | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('devproof_theme', theme);
  }, [theme]);

  // Fetch live backend health and track count dynamically
  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setHealth(data))
      .catch(() => {});

    fetch(`${API_BASE}/api/tracks`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data)) setTrackCount(data.length);
      })
      .catch(() => {});
  }, [currentPath]);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Determine active view mode
  const getActiveMode = (): 'dashboard' | 'track' | 'track_detail' | 'diff' | 'repomonitor' | 'settings' | 'devtools' | 'activity' => {
    if (currentPath === '/' || currentPath === '/dashboard') return 'dashboard';
    if (currentPath.startsWith('/tracks/')) return 'track_detail';
    if (currentPath.startsWith('/diff/')) return 'diff';
    if (currentPath === '/track' || currentPath.startsWith('/track')) return 'track';
    if (currentPath.startsWith('/repo-monitor')) return 'repomonitor';
    if (currentPath.startsWith('/activity')) return 'activity';
    if (currentPath.startsWith('/settings')) return 'settings';
    if (currentPath.startsWith('/devtools')) return 'devtools';
    return 'dashboard';
  };

  const activeMode = getActiveMode();

  // Extract ID if in a parameterized route
  const getRouteParamId = (): number | null => {
    const trackMatch = currentPath.match(/^\/tracks\/(\d+)/);
    if (trackMatch) return parseInt(trackMatch[1], 10);
    const diffMatch = currentPath.match(/^\/diff\/(\d+)/);
    if (diffMatch) return parseInt(diffMatch[1], 10);
    return null;
  };

  const currentId = getRouteParamId();

  // Navigation Items
  const navItems = [
    { mode: 'dashboard', path: '/', label: 'Overview', icon: '🎓', desc: 'Active Career Tracks' },
    { mode: 'track', path: '/track', label: 'Create Track', icon: '🎯', desc: 'Job Parsing & Link Repo' },
    { mode: 'activity', path: '/activity', label: 'Activity Feed', icon: '⚡', desc: 'Real Event Stream' },
    { mode: 'repomonitor', path: '/repo-monitor', label: 'Repo Sentinel', icon: '🔍', desc: 'Live Polling & Webhooks' },
    { mode: 'settings', path: '/settings', label: 'Integrations', icon: '⚙️', desc: 'Rate Limits & Health Audit' },
    { mode: 'devtools', path: '/devtools', label: 'DevTools', icon: '🛠️', desc: 'Contract Inspection' },
  ];

  // Content Router
  const renderContent = () => {
    if (activeMode === 'dashboard') {
      return <Dashboard onNavigate={navigate} />;
    }

    if (activeMode === 'track_detail' && currentId !== null) {
      return <TrackDetailView trackId={currentId} onNavigate={navigate} />;
    }

    if (activeMode === 'diff' && currentId !== null) {
      return <DiffView trackId={currentId} onNavigate={navigate} />;
    }

    if (activeMode === 'track') {
      return <CareerTrack onNavigate={navigate} />;
    }

    if (activeMode === 'repomonitor') {
      return <RepoMonitor onNavigate={navigate} />;
    }

    if (activeMode === 'activity') {
      return <ActivityFeedView onNavigate={navigate} />;
    }

    if (activeMode === 'settings') {
      return <Settings onNavigate={navigate} />;
    }

    if (activeMode === 'devtools') {
      return <DevTools />;
    }

    return (
      <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <h2 style={{ color: 'var(--text-main)', marginBottom: '10px' }}>Page Not Found</h2>
        <p style={{ marginBottom: '24px' }}>The requested route ({currentPath}) does not exist in DevProof.</p>
        <button
          onClick={() => navigate('/')}
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: '#ffffff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 600,
          }}
        >
          Return to Dashboard
        </button>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}>
      {/* =========================================================================
          LEFT SIDEBAR (DESKTOP + RESPONSIVE DRAWER)
          ========================================================================= */}
      <aside
        style={{
          width: '270px',
          backgroundColor: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 40,
          flexShrink: 0,
          boxShadow: 'var(--shadow-sm)',
          transition: 'transform 0.3s ease, background-color 0.25s ease',
        }}
        className={mobileMenuOpen ? 'sidebar-mobile-open' : ''}
      >
        {/* Brand Header */}
        <div
          onClick={() => navigate('/')}
          style={{
            padding: '22px 20px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--accent-primary), #6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                flexShrink: 0,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '-0.02em', color: 'var(--text-main)', fontFamily: 'var(--font-sans)' }}>
                  DevProof
                </span>
                <span
                  style={{
                    fontSize: '9px',
                    fontWeight: 800,
                    backgroundColor: 'var(--accent-verified-bg)',
                    color: 'var(--accent-verified)',
                    padding: '2px 6px',
                    borderRadius: '8px',
                    letterSpacing: '0.04em',
                  }}
                >
                  PROVED
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 500 }}>
                Evidence-Backed Career Coach
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Section */}
        <div style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 8px', marginBottom: '8px' }}>
            Career Intelligence
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '20px' }}>
            {navItems.slice(0, 3).map((item) => {
              const isActive = activeMode === item.mode;
              return (
                <button
                  key={item.mode}
                  onClick={() => navigate(item.path)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    backgroundColor: isActive ? 'var(--accent-primary-glow)' : 'transparent',
                    color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                    border: isActive ? '1px solid var(--border-highlight)' : '1px solid transparent',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '13px',
                    fontWeight: isActive ? 700 : 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: '16px' }}>{item.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div>{item.label}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 8px', marginBottom: '8px' }}>
            Verification & Audit
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {navItems.slice(3).map((item) => {
              const isActive = activeMode === item.mode;
              return (
                <button
                  key={item.mode}
                  onClick={() => navigate(item.path)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    backgroundColor: isActive ? 'var(--accent-primary-glow)' : 'transparent',
                    color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                    border: isActive ? '1px solid var(--border-highlight)' : '1px solid transparent',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '13px',
                    fontWeight: isActive ? 700 : 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: '16px' }}>{item.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div>{item.label}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sidebar Footer: Watcher + Theme Switcher */}
        <div style={{ padding: '16px 14px', borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface-elevated)' }}>
          {/* Watcher Status */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <span
                className={health?.watcher && health.watcher !== 'unconfigured' && health.watcher !== 'idle' ? 'live-pulse' : ''}
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: !health
                    ? 'var(--text-dim)'
                    : health.watcher === 'polling' || health.watcher === 'both' || health.watcher === 'webhook'
                    ? 'var(--accent-verified)'
                    : 'var(--text-dim)',
                  display: 'inline-block',
                }}
              />
              <span style={{ fontWeight: 600 }}>
                {!health
                  ? 'Watcher Checking...'
                  : health.watcher === 'polling' || health.watcher === 'both'
                  ? `Watcher Active (${health.next_poll_in_s ?? 20}s)`
                  : health.watcher === 'webhook'
                  ? 'Watcher Active (Webhook)'
                  : 'Watcher Standby'}
              </span>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono, monospace' }}>HTTP/SSE</span>
          </div>

          {/* Theme Button */}
          <button
            id="theme-toggle-btn"
            aria-label="Toggle Night Study Theme"
            onClick={toggleTheme}
            style={{
              width: '100%',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-card)',
              color: 'var(--text-main)',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <span>{theme === 'light' ? '🌙' : '☀️'}</span>
            <span>{theme === 'light' ? 'Night-Study Dark Mode' : 'Luminous Light Mode'}</span>
          </button>
        </div>
      </aside>

      {/* =========================================================================
          MAIN COLUMN (TOP HEADER BAR + CONTENT)
          ========================================================================= */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header Bar */}
        <header
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
            padding: '12px 28px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            zIndex: 30,
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Left: Mobile Toggle & Breadcrumbs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                display: 'none',
                backgroundColor: 'transparent',
                border: 'none',
                fontSize: '20px',
                color: 'var(--text-main)',
                padding: '4px',
              }}
              className="mobile-menu-btn"
              aria-label="Toggle Navigation Menu"
            >
              ☰
            </button>

            {/* Breadcrumb Path */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-dim)' }}>
              <span onClick={() => navigate('/')} style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text-muted)' }}>
                DevProof
              </span>
              <span>/</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>
                {activeMode === 'dashboard' && 'Candidate Overview'}
                {activeMode === 'track' && 'Create Career Track'}
                {activeMode === 'track_detail' && `Career Track #${currentId}`}
                {activeMode === 'diff' && `Proof Diff Engine #${currentId}`}
                {activeMode === 'activity' && 'Real Activity Feed'}
                {activeMode === 'repomonitor' && 'Repo Push Sentinel'}
                {activeMode === 'settings' && 'Integrations & Environment'}
                {activeMode === 'devtools' && 'Developer Verification Tools'}
              </span>
            </div>
          </div>

          {/* Right: Rate Quota + Student Profile Avatar + CTA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Live Status Pill */}
            {(() => {
              if (!health) {
                return (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      border: '1px solid var(--border-card)',
                    }}
                  >
                    <span>○</span>
                    <span>GitHub API Checking...</span>
                  </div>
                );
              }
              if (health.github === 'ok') {
                return (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--accent-verified)',
                      backgroundColor: 'var(--accent-verified-bg)',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                    }}
                  >
                    <span>●</span>
                    <span>
                      GitHub API {health.github_rate_remaining !== null && health.github_rate_remaining !== undefined ? `${health.github_rate_remaining} req/h` : 'Authenticated'}
                    </span>
                  </div>
                );
              }
              if (health.github === 'rate_limited') {
                return (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#ef4444',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                    }}
                  >
                    <span>⚠</span>
                    <span>GitHub Rate Limited</span>
                  </div>
                );
              }
              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--accent-warn, #f59e0b)',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                  }}
                >
                  <span>○</span>
                  <span>GitHub Unauthenticated (60 req/h)</span>
                </div>
              );
            })()}

            {/* Primary Action Button */}
            <button
              onClick={() => navigate('/track')}
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: 700,
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>+</span>
              <span>New Career Track</span>
            </button>

            {/* Honest Candidate Portfolio Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '4px 10px 4px 6px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-card)',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent-primary), #06b6d4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '12px',
                  letterSpacing: '0.04em',
                }}
              >
                CP
              </div>
              <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                  Candidate Portfolio
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                  {trackCount !== null
                    ? `${trackCount} ${trackCount === 1 ? 'Track' : 'Tracks'} Active`
                    : 'Workspace Active'}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main style={{ flex: 1, padding: '24px 32px' }}>
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default App;
