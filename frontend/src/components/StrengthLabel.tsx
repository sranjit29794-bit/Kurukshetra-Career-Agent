import React from 'react';
import { ShieldCheck, ShieldAlert, Shield, ShieldX } from 'lucide-react';
import type { Strength } from '../types';

export interface StrengthLabelProps {
  strength: Strength | 'weak';
  size?: 'sm' | 'md';
  className?: string;
}

export const StrengthLabel: React.FC<StrengthLabelProps> = ({
  strength,
  size = 'md',
  className = '',
}) => {
  const iconSize = size === 'sm' ? 12 : 13;
  const padding = size === 'sm' ? '2px 8px' : '3px 10px';
  const fontSize = size === 'sm' ? '11px' : '12px';

  switch (strength) {
    case 'strong':
      return (
        <span
          className={className}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
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
          <ShieldCheck size={iconSize} strokeWidth={2} />
          <span>Strong evidence</span>
        </span>
      );

    case 'moderate':
      return (
        <span
          className={className}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding,
            fontSize,
            fontWeight: 500,
            borderRadius: 'var(--radius-pill, 8px)',
            backgroundColor: 'rgba(251, 191, 36, 0.12)',
            color: '#FBBF24',
            border: '1px solid rgba(251, 191, 36, 0.25)',
            whiteSpace: 'nowrap',
          }}
        >
          <ShieldAlert size={iconSize} strokeWidth={2} />
          <span>Moderate evidence</span>
        </span>
      );

    case 'limited':
    case 'weak':
      return (
        <span
          className={className}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding,
            fontSize,
            fontWeight: 500,
            borderRadius: 'var(--radius-pill, 8px)',
            backgroundColor: 'rgba(148, 163, 184, 0.08)',
            color: '#94A3B8',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            whiteSpace: 'nowrap',
          }}
        >
          <Shield size={iconSize} strokeWidth={2} />
          <span>Weak signal (ignored)</span>
        </span>
      );

    case 'none':
    default:
      return (
        <span
          className={className}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding,
            fontSize,
            fontWeight: 500,
            borderRadius: 'var(--radius-pill, 8px)',
            backgroundColor: 'rgba(148, 163, 184, 0.08)',
            color: '#94A3B8',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            whiteSpace: 'nowrap',
          }}
        >
          <ShieldX size={iconSize} strokeWidth={2} />
          <span>No evidence</span>
        </span>
      );
  }
};
