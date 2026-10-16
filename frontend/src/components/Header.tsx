import React from 'react';
import { RefreshCw, Cpu, GitCommit } from 'lucide-react';

interface HeaderProps {
  currentView: 'dashboard' | 'add_job';
  onNavigate: (view: 'dashboard' | 'add_job') => void;
  llmMode?: 'ai_on' | 'deterministic';
  watcherMode?: 'webhook' | 'polling';
  nextPollInSeconds?: number;
  rateLimitRemaining?: number;
  rateLimitTotal?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  llmMode = 'ai_on',
  watcherMode = 'polling',
  nextPollInSeconds = 15,
  rateLimitRemaining = 4982,
  rateLimitTotal = 5000,
}) => {
  return (
    <>
      <header
        style={{
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--surface)',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
          {/* Logo & Tagline */}
          <div
            onClick={() => onNavigate('dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
          >
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                backgroundColor: 'var(--accent)',
                color: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '16px',
                letterSpacing: '-0.05em',
                boxShadow: '0 0 12px rgba(45, 212, 191, 0.35)',
              }}
            >
              D
            </div>
            <div>
              <span
                style={{
                  fontSize: '17px',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: 'var(--text)',
                }}
              >
                DevProof
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: '11px',
                  color: 'var(--muted)',
                  marginTop: '-2px',
                }}
              >
                Your code. Your proof.
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => onNavigate('dashboard')}
              style={{
                background: currentView === 'dashboard' ? 'var(--surface-2)' : 'transparent',
                border: currentView === 'dashboard' ? '1px solid var(--border)' : '1px solid transparent',
                borderRadius: '6px',
                padding: '6px 14px',
                color: currentView === 'dashboard' ? 'var(--accent)' : 'var(--muted)',
                fontWeight: currentView === 'dashboard' ? 600 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Dashboard
            </button>
            <button
              onClick={() => onNavigate('add_job')}
              style={{
                background: currentView === 'add_job' ? 'var(--surface-2)' : 'transparent',
                border: currentView === 'add_job' ? '1px solid var(--border)' : '1px solid transparent',
                borderRadius: '6px',
                padding: '6px 14px',
                color: currentView === 'add_job' ? 'var(--accent)' : 'var(--muted)',
                fontWeight: currentView === 'add_job' ? 600 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              + Add Job
            </button>
          </nav>
        </div>

        {/* Global Status Chips per BRAIN §16.2 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
          {/* Watcher Chip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          >
            {watcherMode === 'webhook' ? (
              <>
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent)',
                    boxShadow: '0 0 6px var(--accent)',
                  }}
                />
                <span>Listening via webhook</span>
              </>
            ) : (
              <>
                <RefreshCw size={12} style={{ color: 'var(--accent)' }} />
                <span>Polling · next in {nextPollInSeconds}s</span>
              </>
            )}
          </div>

          {/* LLM Chip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: 'var(--surface-2)',
              border: '1px solid var(--border)',
            }}
          >
            <Cpu
              size={12}
              style={{
                color: llmMode === 'ai_on' ? 'var(--status-demonstrated)' : 'var(--muted)',
              }}
            />
            <span style={{ color: 'var(--text)' }}>
              {llmMode === 'ai_on' ? 'AI on' : 'Deterministic mode'}
            </span>
          </div>

          {/* GitHub Rate Limit Chip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--muted)',
            }}
          >
            <GitCommit size={12} />
            <span>
              {rateLimitRemaining.toLocaleString()} / {rateLimitTotal.toLocaleString()}
            </span>
          </div>
        </div>
      </header>

      {/* Persistent Banner per BRAIN §16.2: "Not demonstrated means not found..." */}
      <div
        style={{
          backgroundColor: 'rgba(45, 212, 191, 0.08)',
          borderBottom: '1px solid rgba(45, 212, 191, 0.2)',
          padding: '8px 24px',
          fontSize: '12.5px',
          color: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span style={{ fontSize: '14px' }}>ℹ️</span>
        <span>
          <strong>Notice:</strong> Not demonstrated means not found in the analyzed scope — it doesn't prove you lack the skill.
        </span>
      </div>
    </>
  );
};
