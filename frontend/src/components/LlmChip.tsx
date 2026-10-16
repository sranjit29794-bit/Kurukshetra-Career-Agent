import React from 'react';
import { Cpu, Sparkles } from 'lucide-react';

export interface LlmChipProps {
  mode: 'ai_on' | 'deterministic';
  compact?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export const LlmChip: React.FC<LlmChipProps> = ({
  mode,
  compact = false,
  size = 'md',
  className = '',
}) => {
  const padding = size === 'sm' ? '2px 8px' : '4px 10px';
  const fontSize = size === 'sm' ? '11px' : '12px';
  const isAi = mode === 'ai_on';

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
        color: isAi ? 'var(--text, #E8EEF9)' : 'var(--muted, #8C9AB8)',
        whiteSpace: 'nowrap',
      }}
    >
      {isAi ? (
        <Sparkles size={12} style={{ color: '#34D399' }} />
      ) : (
        <Cpu size={12} style={{ color: 'var(--muted, #8C9AB8)' }} />
      )}
      <span>
        {isAi ? (compact ? 'AI active' : 'AI Analysis active') : 'Deterministic mode'}
      </span>
    </span>
  );
};
