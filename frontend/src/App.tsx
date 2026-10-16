import { useState, useEffect } from 'react';
import { DevTools } from './pages/DevTools';

export function App() {
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname);

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
  };

  // If on /devtools or if directly accessed, render DevTools
  if (currentPath === '/devtools' || currentPath.startsWith('/devtools')) {
    return (
      <div>
        <nav
          style={{
            backgroundColor: '#0b0f14',
            borderBottom: '1px solid #243040',
            padding: '10px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontWeight: 700, color: '#e6edf3', fontSize: '15px' }}>DevProof</span>
            <span
              style={{
                backgroundColor: '#17202b',
                color: '#2dd4bf',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              DevTools Mode
            </span>
          </div>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'transparent',
              border: '1px solid #243040',
              color: '#8b98a5',
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            ← Back to Home
          </button>
        </nav>
        <DevTools />
      </div>
    );
  }

  // Root Page: Reserved for Member 3 (Main Application UI)
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '80vh',
        padding: '40px 20px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          backgroundColor: '#17202b',
          border: '1px solid #2dd4bf',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          marginBottom: '20px',
        }}
      >
        ⚡
      </div>
      <h1 style={{ fontSize: '36px', color: '#e6edf3', marginBottom: '12px' }}>
        DevProof
      </h1>
      <p style={{ color: '#8b98a5', fontSize: '18px', maxWidth: '600px', marginBottom: '8px' }}>
        <em>"Resumes claim. Repositories prove. DevProof keeps the proof current."</em>
      </p>
      <p style={{ color: '#64748b', fontSize: '14px', maxWidth: '540px', marginBottom: '32px' }}>
        Phase 0 repository foundation active. This main landing view is reserved for Member 3
        to implement the primary user journey in Phase 1 without merge conflicts.
      </p>

      <div
        style={{
          backgroundColor: '#111820',
          border: '1px solid #243040',
          borderRadius: '8px',
          padding: '20px',
          maxWidth: '500px',
          width: '100%',
          textAlign: 'left',
          marginBottom: '24px',
        }}
      >
        <div style={{ color: '#e6edf3', fontWeight: 600, marginBottom: '8px', fontSize: '14px' }}>
          Team Ownership Boundaries (Phase 0):
        </div>
        <ul style={{ color: '#8b98a5', fontSize: '13px', lineHeight: '1.7', paddingLeft: '20px' }}>
          <li><strong style={{ color: '#e6edf3' }}>Member 1:</strong> Backend, GitHub API, Change Sentinel</li>
          <li><strong style={{ color: '#e6edf3' }}>Member 2:</strong> Code detectors, LLM Judge, Verifier</li>
          <li><strong style={{ color: '#e6edf3' }}>Member 3:</strong> Application UI & User Journey (this space)</li>
          <li><strong style={{ color: '#e6edf3' }}>Member 4:</strong> Evidence Viewer, Diff/Compare UI, Demo Polish</li>
        </ul>
      </div>

      <button
        onClick={() => navigate('/devtools')}
        style={{
          backgroundColor: '#2dd4bf',
          color: '#0b0f14',
          border: 'none',
          padding: '12px 24px',
          borderRadius: '6px',
          fontWeight: 600,
          fontSize: '14px',
          cursor: 'pointer',
          boxShadow: '0 0 15px rgba(45, 212, 191, 0.3)',
        }}
      >
        Open Developer Verification Screen (/devtools) →
      </button>
    </div>
  );
}

export default App;
