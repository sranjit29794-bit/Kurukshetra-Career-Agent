import { useState, useEffect } from 'react';
import { Dashboard } from './pages/Dashboard';
import { CareerTrack } from './pages/CareerTrack';
import { TrackDetailView } from './pages/TrackDetailView';
import { DiffView } from './pages/DiffView';
import { RepoMonitor } from './pages/RepoMonitor';
import { Settings } from './pages/Settings';
import { DevTools } from './pages/DevTools';
import { ActivityFeedView } from './pages/ActivityFeedView';

export function App() {
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('devproof_theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('devproof_theme', theme);
  }, [theme]);

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

  // Primary App Shell Navigation
  const renderNav = () => (
    <nav
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '14px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backdropFilter: 'blur(12px)',
        boxShadow: 'var(--shadow-sm)',
        transition: 'background-color 0.25s ease, border-color 0.25s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
        {/* Brand Logo & Name */}
        <div
          onClick={() => navigate('/')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--accent-primary), #6366f1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              color: '#ffffff',
              fontWeight: 800,
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.28)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '18px', letterSpacing: '-0.02em', fontFamily: 'var(--font-sans)' }}>
                DevProof
              </span>
              <span
                style={{
                  fontSize: '11px',
                  backgroundColor: 'var(--accent-verified-bg)',
                  color: 'var(--accent-verified)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                }}
              >
                STUDENT CAREER INTELLIGENCE
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 500 }}>
              Evidence-Backed Internship & Job Readiness
            </div>
          </div>
        </div>

        {/* Breadcrumb Context if inside a Track or Diff */}
        {currentId !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-dim)' }}>
            <span>/</span>
            <span
              onClick={() => navigate(`/tracks/${currentId}`)}
              style={{
                color: activeMode === 'track_detail' ? 'var(--accent-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Career Track #{currentId}
            </span>
            {activeMode === 'diff' && (
              <>
                <span>/</span>
                <span style={{ color: 'var(--accent-verified)', fontWeight: 600 }}>Diff Engine</span>
              </>
            )}
          </div>
        )}

        {/* Primary Route Tabs */}
        <div style={{ display: 'flex', gap: '6px', marginLeft: '12px', flexWrap: 'wrap' }}>
          {[
            { mode: 'dashboard', path: '/', label: 'Overview', icon: '🎓' },
            { mode: 'track', path: '/track', label: 'Create Track', icon: '🎯' },
            { mode: 'activity', path: '/activity', label: 'Activity Feed', icon: '⚡' },
            { mode: 'repomonitor', path: '/repo-monitor', label: 'Repo Sentinel', icon: '🔍' },
            { mode: 'settings', path: '/settings', label: 'Integrations', icon: '⚙️' },
            { mode: 'devtools', path: '/devtools', label: 'DevTools', icon: '🛠️' },
          ].map((item) => {
            const isActive = activeMode === item.mode;
            return (
              <button
                key={item.mode}
                onClick={() => navigate(item.path)}
                style={{
                  backgroundColor: isActive ? 'var(--accent-primary-glow)' : 'transparent',
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                  border: isActive ? '1px solid var(--border-highlight)' : '1px solid transparent',
                  padding: '7px 16px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13px',
                  fontWeight: isActive ? 700 : 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Action Utilities & Theme Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Watcher Status Indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            color: 'var(--text-muted)',
            backgroundColor: 'var(--bg-surface-elevated)',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <span className="live-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-verified)', display: 'inline-block' }} />
          <span style={{ fontWeight: 600 }}>Watcher Active (20s)</span>
        </div>

        {/* Theme Toggle Button */}
        <button
          id="theme-toggle-btn"
          aria-label="Toggle Night Study Theme"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to Night-Study Dark Mode' : 'Switch to Student Luminous Light Mode'}
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-card)',
            color: 'var(--text-main)',
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
          }}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>

        {/* Primary CTA */}
        <button
          onClick={() => navigate('/track')}
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: '#ffffff',
            border: 'none',
            padding: '8px 18px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '13px',
            fontWeight: 700,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          + New Career Track
        </button>
      </div>
    </nav>
  );

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
            padding: '10px 22px',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 700,
          }}
        >
          Return to Overview
        </button>
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {renderNav()}
      <main style={{ flex: 1 }}>{renderContent()}</main>
    </div>
  );
}

export default App;
