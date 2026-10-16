import React from 'react';
import { ArrowUp, RefreshCw, Minus } from 'lucide-react';

export interface UpdatedChipProps {
  type?: 'files' | 'reassessed' | 'no_change' | 'not_reassessed' | 'carried_forward' | 'improved' | 'custom';
  count?: number;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const UpdatedChip: React.FC<UpdatedChipProps> = ({
  type = 'no_change',
  count,
  label,
  size = 'md',
  className = '',
}) => {
  const iconSize = size === 'sm' ? 11 : 12;
  const padding = size === 'sm' ? '2px 8px' : '3px 9px';
  const fontSize = size === 'sm' ? '11px' : '12px';

  if (type === 'files' && count && count > 0) {
    return (
      <span
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding,
          fontSize,
          fontWeight: 500,
          borderRadius: 'var(--radius-pill, 8px)',
          backgroundColor: 'rgba(52, 211, 153, 0.12)',
          color: '#34D399',
          border: '1px solid rgba(52, 211, 153, 0.25)',
          whiteSpace: 'nowrap',
        }}
      >
        <ArrowUp size={iconSize} strokeWidth={2.5} />
        <span>
          {count} new file{count > 1 ? 's' : ''}
        </span>
      </span>
    );
  }

  if (type === 'reassessed' || type === 'improved') {
    return (
      <span
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding,
          fontSize,
          fontWeight: 500,
          borderRadius: 'var(--radius-pill, 8px)',
          backgroundColor: 'rgba(52, 211, 153, 0.12)',
          color: '#34D399',
          border: '1px solid rgba(52, 211, 153, 0.25)',
          whiteSpace: 'nowrap',
        }}
      >
        <RefreshCw size={iconSize} />
        <span>{label || 'Reassessed'}</span>
      </span>
    );
  }

  if (label && type === 'custom') {
    return (
      <span
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding,
          fontSize,
          fontWeight: 500,
          borderRadius: 'var(--radius-pill, 8px)',
          backgroundColor: 'var(--surface-2, #101A30)',
          color: 'var(--text, #E8EEF9)',
          border: '1px solid var(--border, #1A2748)',
          whiteSpace: 'nowrap',
        }}
      >
        <span>{label}</span>
      </span>
    );
  }

  if (type === 'not_reassessed') {
    return (
      <span
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding,
          fontSize,
          fontWeight: 400,
          borderRadius: 'var(--radius-pill, 8px)',
          backgroundColor: 'transparent',
          color: 'var(--muted, #8C9AB8)',
          border: '1px solid transparent',
          whiteSpace: 'nowrap',
        }}
      >
        <Minus size={iconSize} />
        <span>{label || 'Not reassessed'}</span>
      </span>
    );
  }

  // Default: no_change
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding,
        fontSize,
        fontWeight: 400,
        borderRadius: 'var(--radius-pill, 8px)',
        backgroundColor: 'transparent',
        color: 'var(--muted, #8C9AB8)',
        border: '1px solid transparent',
        whiteSpace: 'nowrap',
      }}
    >
      <Minus size={iconSize} />
      <span>{label || 'No change'}</span>
    </span>
  );
};
