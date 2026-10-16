import React from 'react';
import { ChevronDown, Sliders } from 'lucide-react';
import { WatcherChip } from './WatcherChip';
import { LlmChip } from './LlmChip';
import { RateLimitChip } from './RateLimitChip';

export interface TopBarProps {
  watcherMode?: 'webhook' | 'polling';
  nextPollInSeconds?: number;
  llmMode?: 'ai_on' | 'deterministic';
  rateLimitRemaining?: number;
  rateLimitTotal?: number;
  onNavigate?: (path: string) => void;
  className?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  watcherMode = 'webhook',
  nextPollInSeconds = 15,
  llmMode = 'ai_on',
  rateLimitRemaining = 4982,
  rateLimitTotal = 5000,
  onNavigate,
  className = '',
}) => {
  return (
    <header
      className={className}
      style={{
        height: '56px',
        backgroundColor: 'var(--surface, #0A1228)',
        borderBottom: '1px solid var(--border, #1A2748)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '0 24px',
        gap: '12px',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      {/* Dev Components Link */}
      {onNavigate && (
        <button
          onClick={() => onNavigate('/dev/components')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 600,
            borderRadius: 'var(--radius-pill, 8px)',
            backgroundColor: 'rgba(47, 109, 246, 0.1)',
            color: 'var(--primary, #2F6DF6)',
            border: '1px solid rgba(47, 109, 246, 0.25)',
            cursor: 'pointer',
            marginRight: 'auto',
          }}
        >
          <Sliders size={12} />
          <span>/dev/components</span>
        </button>
      )}

      {/* Watcher status */}
      <WatcherChip
        mode={watcherMode}
        nextPollInSeconds={nextPollInSeconds}
        size="sm"
      />

      {/* LLM Status */}
      <LlmChip
        mode={llmMode}
        compact
        size="sm"
      />

      {/* GitHub Rate Limit */}
      <RateLimitChip
        remaining={rateLimitRemaining}
        total={rateLimitTotal}
        compact
        size="sm"
      />

      {/* Static Demo Profile Chip (no auth, no dropdown per prompt) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '9px',
          padding: '4px 10px 4px 6px',
          borderRadius: '20px',
          backgroundColor: 'var(--surface-2, #101A30)',
          border: '1px solid var(--border, #1A2748)',
          cursor: 'default',
          userSelect: 'none',
        }}
      >
        {/* Avatar circle */}
        <div
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            backgroundColor: 'rgba(47, 109, 246, 0.3)',
            color: '#E8EEF9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '12px',
            border: '1px solid rgba(47, 109, 246, 0.4)',
          }}
        >
          R
        </div>

        <span
          style={{
            fontSize: '12.5px',
            fontWeight: 500,
            color: 'var(--text, #E8EEF9)',
          }}
        >
          Rohan Sharma
        </span>

        <ChevronDown size={13} style={{ color: 'var(--muted, #8C9AB8)' }} />
      </div>
    </header>
  );
};
