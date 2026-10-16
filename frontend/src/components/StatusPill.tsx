import React from 'react';
import { Check, CircleDot, Circle, AlertTriangle } from 'lucide-react';
import type { Status } from '../types';

export interface StatusPillProps {
  status: Status;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const StatusPill: React.FC<StatusPillProps> = ({
  status,
  size = 'md',
  showLabel = true,
  className = '',
}) => {
  const iconSize = size === 'sm' ? 12 : size === 'lg' ? 15 : 13;
  const padding = size === 'sm' ? '2px 8px' : size === 'lg' ? '6px 14px' : '3px 10px';
  const fontSize = size === 'sm' ? '11px' : size === 'lg' ? '13px' : '12px';

  switch (status) {
    case 'DEMONSTRATED':
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
            backgroundColor: 'var(--status-demonstrated-bg, rgba(52, 211, 153, 0.12))',
            color: 'var(--status-demonstrated, #34D399)',
            border: '1px solid var(--status-demonstrated-border, rgba(52, 211, 153, 0.28))',
            whiteSpace: 'nowrap',
          }}
        >
          <Check size={iconSize} strokeWidth={2.5} />
          {showLabel && <span>Demonstrated</span>}
        </span>
      );

    case 'PARTIAL':
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
            backgroundColor: 'var(--status-partial-bg, rgba(251, 191, 36, 0.12))',
            color: 'var(--status-partial, #FBBF24)',
            border: '1px solid var(--status-partial-border, rgba(251, 191, 36, 0.28))',
            whiteSpace: 'nowrap',
          }}
        >
          <CircleDot size={iconSize} strokeWidth={2.2} />
          {showLabel && <span>Partially Demonstrated</span>}
        </span>
      );

    case 'NOT_DEMONSTRATED':
      // CRITICAL INVARIANT: Slate dashed outline, NEVER red (BRAIN §3 & DESIGN-REFERENCE)
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
            backgroundColor: 'var(--status-not-demonstrated-bg, rgba(148, 163, 184, 0.08))',
            color: 'var(--status-not-demonstrated, #94A3B8)',
            border: '1px dashed var(--status-not-demonstrated-border, #94A3B8)',
            whiteSpace: 'nowrap',
          }}
        >
          <Circle size={iconSize} strokeWidth={1.8} style={{ strokeDasharray: '2 2' }} />
          {showLabel && <span>Not Demonstrated</span>}
        </span>
      );

    case 'UNABLE_TO_ASSESS':
    default:
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
            backgroundColor: 'var(--status-unable-bg, rgba(167, 139, 250, 0.12))',
            color: 'var(--status-unable, #A78BFA)',
            border: '1px solid var(--status-unable-border, rgba(167, 139, 250, 0.28))',
            whiteSpace: 'nowrap',
          }}
        >
          <AlertTriangle size={iconSize} strokeWidth={2} />
          {showLabel && <span>Unable to Assess</span>}
        </span>
      );
  }
};
