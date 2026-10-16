import {
  Home,
  CheckCircle,
  Briefcase,
  GitBranch,
  Sparkles,
  Settings,
  Zap,
  Code2,
  GitCommit,
} from 'lucide-react';

export interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  trackId?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  onNavigate,
  trackId = 'track_demo',
}) => {
  const navItems = [
    { label: 'Home', path: '/', icon: Home },
    { label: 'Assessments', path: `/tracks/${trackId}`, icon: CheckCircle },
    { label: 'Changes & Diff', path: '/changes', icon: GitCommit },
    { label: 'Jobs', path: '/add-job', icon: Briefcase },
    { label: 'GitHub', path: '/repositories', icon: GitBranch },
    { label: 'Agent Activity', path: '/activity', icon: Sparkles },
  ];

  const isNavActive = (path: string) => {
    if (path === '/') return currentPath === '/';
    if (path.startsWith('/tracks/')) {
      return currentPath.startsWith('/tracks/') && !currentPath.includes('/changes') && !currentPath.includes('/compare');
    }
    return currentPath === path;
  };

  return (
    <aside
      style={{
        width: '240px',
        backgroundColor: 'var(--surface, #0A1228)',
        borderRight: '1px solid var(--border, #1A2748)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        flexShrink: 0,
        height: '100vh',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div>
        {/* Brand Logo & Tagline */}
        <div
          onClick={() => onNavigate('/')}
          style={{
            padding: '24px 20px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
          }}
        >
          {/* Blue faceted logo icon */}
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '9px',
              background: 'linear-gradient(135deg, #2F6DF6 0%, #1D4ED8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 0 16px rgba(47, 109, 246, 0.5)',
              flexShrink: 0,
            }}
          >
            <Code2 size={18} strokeWidth={2.6} />
          </div>

          <div>
            <div
              style={{
                fontSize: '17px',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: 'var(--text, #E8EEF9)',
                lineHeight: 1.15,
              }}
            >
              DevProof
            </div>
            <div
              style={{
                fontSize: '11px',
                color: 'var(--muted, #8C9AB8)',
                letterSpacing: '-0.01em',
              }}
            >
              Your code. Your proof.
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <nav style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item) => {
            const active = isNavActive(item.path);
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={() => onNavigate(item.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: active ? 600 : 500,
                  color: active ? '#FFFFFF' : 'var(--muted, #8C9AB8)',
                  backgroundColor: active ? 'var(--primary, #2F6DF6)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: active ? '0 2px 10px rgba(47, 109, 246, 0.35)' : 'none',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'var(--surface-2, #101A30)';
                    e.currentTarget.style.color = 'var(--text, #E8EEF9)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--muted, #8C9AB8)';
                  }
                }}
              >
                <Icon size={16} strokeWidth={active ? 2.3 : 1.9} />
                <span>{item.label}</span>
              </button>
            );
          })}

          {/* Settings as disabled stub */}
          <button
            disabled
            title="Settings (read-only in demo mode)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--muted, #8C9AB8)',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'not-allowed',
              opacity: 0.45,
              textAlign: 'left',
            }}
          >
            <Settings size={16} strokeWidth={1.9} />
            <span>Settings</span>
          </button>
        </nav>
      </div>

      {/* Bottom Live & Change-Aware Card */}
      <div style={{ padding: '16px 14px 20px' }}>
        <div
          style={{
            backgroundColor: 'var(--surface-2, #101A30)',
            border: '1px solid var(--border, #1A2748)',
            borderRadius: '12px',
            padding: '14px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--text, #E8EEF9)',
              marginBottom: '4px',
            }}
          >
            <Zap size={14} style={{ color: '#2F6DF6', fill: '#2F6DF6' }} />
            <span>Live & Change-Aware</span>
          </div>
          <div
            style={{
              fontSize: '11px',
              lineHeight: 1.35,
              color: 'var(--muted, #8C9AB8)',
            }}
          >
            Automatically reassesses when your code changes.
          </div>
        </div>
      </div>
    </aside>
  );
};
