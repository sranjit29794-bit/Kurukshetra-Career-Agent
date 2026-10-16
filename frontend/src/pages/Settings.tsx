import React, { useEffect, useState } from 'react';
import type { HealthResponse } from '../types/contract';
import { API_BASE } from '../api/config';

interface SettingsProps {
  onNavigate: (route: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({ onNavigate }) => {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setHealth(data))
      .catch(() => {});
  }, []);

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1100px', margin: '0 auto', padding: '36px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              System Configuration
            </span>
            <span style={{ color: 'var(--text-dim)' }}>/</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Integrations & Watcher</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-main)', margin: '0 0 6px 0' }}>
            Integrations & Environment
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
            Manage server-side watcher mechanics, GitHub webhook subscriptions, and API rate limits.
          </p>
        </div>

        <button
          onClick={() => onNavigate('/')}
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
          ← Return to Dashboard
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        {/* Watcher Health Status Card */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-card)',
            borderRadius: 'var(--radius-md)',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Live Watcher Engine
            </h2>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--accent-emerald)',
                backgroundColor: 'var(--accent-emerald-glow)',
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <span className="live-pulse" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-emerald)' }} />
              ACTIVE
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Background Strategy:</span>
              <strong style={{ color: 'var(--text-main)' }}>Periodic Polling (20s)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Webhook Receiver:</span>
              <strong style={{ color: 'var(--accent-cyan)' }}>HMAC SHA-256 Enabled</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>GitHub Rate Limit State:</span>
              <strong style={{ color: health?.github === 'rate_limited' ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
                {health?.github_rate_remaining !== null && health?.github_rate_remaining !== undefined
                  ? `${health.github_rate_remaining} reqs remaining`
                  : 'Normal'}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>File Cache & AST Engine:</span>
              <strong style={{ color: 'var(--text-main)' }}>SQLite Blob Cache</strong>
            </div>
          </div>
        </div>

        {/* GitHub Token Setup Guidance */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-card)',
            borderRadius: 'var(--radius-md)',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 12px 0' }}>
            GitHub Authentication (Server-Side)
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6', marginBottom: '14px' }}>
            DevProof works out of the box with public repositories. To increase GitHub's rate limit from <strong>60 req/hr</strong> to <strong>5,000 req/hr</strong>, configure your token in the backend environment.
          </p>

          <div
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '12px',
              color: 'var(--accent-cyan)',
              marginBottom: '14px',
              overflowX: 'auto',
            }}
          >
            # Add to backend/.env (Never commit this file)<br />
            GITHUB_TOKEN=github_pat_xxxx...
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-dim)', lineHeight: '1.5' }}>
            🔒 <strong>Security Policy:</strong> DevProof will never ask you to paste secrets or tokens into a frontend browser form. Tokens remain strictly server-side.
          </div>
        </div>
      </div>

      {/* GitHub Webhook Setup Guide */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-md)',
          padding: '28px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <span style={{ fontSize: '20px' }}>🔗</span>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
            Configuring a Live GitHub Repository Webhook
          </h2>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
          To trigger instant, zero-latency reassessments upon pushing new code, register DevProof's webhook endpoint in your GitHub repository settings.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ backgroundColor: 'var(--bg-surface-elevated)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px' }}>1. Payload URL</div>
            <code style={{ fontSize: '13px', color: 'var(--accent-cyan)', wordBreak: 'break-all' }}>
              http://&lt;your-host&gt;:8000/api/webhooks/github
            </code>
          </div>

          <div style={{ backgroundColor: 'var(--bg-surface-elevated)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px' }}>2. Content Type</div>
            <code style={{ fontSize: '13px', color: 'var(--accent-emerald)' }}>
              application/json
            </code>
          </div>

          <div style={{ backgroundColor: 'var(--bg-surface-elevated)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px' }}>3. Secret</div>
            <code style={{ fontSize: '13px', color: 'var(--text-main)' }}>
              Must match GITHUB_WEBHOOK_SECRET in .env
            </code>
          </div>

          <div style={{ backgroundColor: 'var(--bg-surface-elevated)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px' }}>4. Event Trigger</div>
            <code style={{ fontSize: '13px', color: 'var(--accent-amber)' }}>
              Just the push event
            </code>
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-surface-elevated)', borderLeft: '4px solid var(--accent-cyan)', padding: '14px 18px', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600, marginBottom: '4px' }}>
            Honest Fallback Guarantee
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            If your local development environment does not have a public domain (e.g. ngrok or public IP), DevProof automatically and seamlessly falls back to its 20-second background polling watcher. No action required!
          </div>
        </div>
      </div>
    </div>
  );
};
