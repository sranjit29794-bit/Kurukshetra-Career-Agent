import React from 'react';
import { GitCommit } from 'lucide-react';

export interface RateLimitChipProps {
  remaining?: number;
  total?: number;
  compact?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export const RateLimitChip: React.FC<RateLimitChipProps> = ({
  remaining = 4982,
  total = 5000,
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
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 500,
        borderRadius: 'var(--radius-pill, 8px)',
        backgroundColor: 'var(--surface-2, #101A30)',
        border: '1px solid var(--border, #1A2748)',
        color: 'var(--muted, #8C9AB8)',
        whiteSpace: 'nowrap',
      }}
      title="GitHub API Rate Limit"
    >
      <GitCommit size={12} style={{ color: 'var(--muted, #8C9AB8)' }} />
      <span>
        {compact
          ? `${remaining.toLocaleString()}`
          : `${remaining.toLocaleString()} / ${total.toLocaleString()} req`}
      </span>
    </span>
  );
};
