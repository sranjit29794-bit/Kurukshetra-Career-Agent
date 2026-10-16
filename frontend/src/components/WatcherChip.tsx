import React from 'react';
import { RefreshCw } from 'lucide-react';

export interface WatcherChipProps {
  mode: 'webhook' | 'polling' | 'both';
  nextPollInSeconds?: number;
  compact?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export const WatcherChip: React.FC<WatcherChipProps> = ({
  mode,
  nextPollInSeconds = 15,
  compact = false,
  size = 'md',
  className = '',
}) => {
  const padding = size === 'sm' ? '2px 8px' : '4px 10px';
  const fontSize = size === 'sm' ? '11px' : '12px';

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding,
        fontSize,
        fontWeight: 500,
        borderRadius: 'var(--radius-pill, 8px)',
        backgroundColor: 'var(--surface-2, #101A30)',
        border: '1px solid var(--border, #1A2748)',
        color: 'var(--text, #E8EEF9)',
        whiteSpace: 'nowrap',
      }}
    >
      {mode === 'webhook' ? (
        <>
          <span
            className="pulse-dot"
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: '#34D399',
              display: 'inline-block',
            }}
          />
          <span>{compact ? 'Webhook' : 'Listening via webhook'}</span>
        </>
      ) : (
        <>
          <RefreshCw size={12} style={{ color: 'var(--primary, #2F6DF6)' }} />
          <span>{compact ? `Polling (${nextPollInSeconds}s)` : `Polling · next in ${nextPollInSeconds}s`}</span>
        </>
      )}
    </span>
  );
};
