import React from 'react';
import { CheckCircle2, CircleDot, Circle, AlertTriangle } from 'lucide-react';
import type { Status } from '../types';

interface StatusBadgeProps {
  status: Status;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showLabel = true,
}) => {
  const iconSize = size === 'sm' ? 12 : size === 'lg' ? 16 : 14;
  const padding = size === 'sm' ? '2px 6px' : size === 'lg' ? '6px 12px' : '4px 8px';
  const fontSize = size === 'sm' ? '11px' : size === 'lg' ? '13px' : '12px';

  switch (status) {
    case 'DEMONSTRATED':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding,
            fontSize,
            fontWeight: 600,
            borderRadius: '9999px',
            backgroundColor: 'rgba(52, 211, 153, 0.12)',
            color: 'var(--status-demonstrated)',
            border: '1px solid rgba(52, 211, 153, 0.3)',
            whiteSpace: 'nowrap',
          }}
        >
          <CheckCircle2 size={iconSize} />
          {showLabel && <span>Demonstrated</span>}
        </span>
      );

    case 'PARTIAL':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding,
            fontSize,
            fontWeight: 600,
            borderRadius: '9999px',
            backgroundColor: 'rgba(251, 191, 36, 0.12)',
            color: 'var(--status-partial)',
            border: '1px solid rgba(251, 191, 36, 0.3)',
            whiteSpace: 'nowrap',
          }}
        >
          <CircleDot size={iconSize} />
          {showLabel && <span>Partially demonstrated</span>}
        </span>
      );

    case 'NOT_DEMONSTRATED':
      // CRITICAL: Slate dashed outline, NEVER red (BRAIN §16.1 & Engine Invariant #10)
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding,
            fontSize,
            fontWeight: 500,
            borderRadius: '9999px',
            backgroundColor: 'rgba(148, 163, 184, 0.08)',
            color: 'var(--status-not-demonstrated)',
            border: '1px dashed var(--status-not-demonstrated)',
            whiteSpace: 'nowrap',
          }}
        >
          <Circle size={iconSize} style={{ strokeDasharray: '2 2' }} />
          {showLabel && <span>Not demonstrated in analyzed scope</span>}
        </span>
      );

    case 'UNABLE_TO_ASSESS':
    default:
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding,
            fontSize,
            fontWeight: 600,
            borderRadius: '9999px',
            backgroundColor: 'rgba(167, 139, 250, 0.12)',
            color: 'var(--status-unable)',
            border: '1px solid rgba(167, 139, 250, 0.3)',
            whiteSpace: 'nowrap',
          }}
        >
          <AlertTriangle size={iconSize} />
          {showLabel && <span>Unable to assess</span>}
        </span>
      );
  }
};
