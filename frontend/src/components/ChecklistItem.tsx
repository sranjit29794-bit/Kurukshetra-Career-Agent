import React from 'react';
import { Check, CircleDot, Circle, AlertTriangle } from 'lucide-react';

export type ChecklistStatus = 'completed' | 'partial' | 'pending' | 'warning';

export interface ChecklistItemProps {
  label: string;
  status: ChecklistStatus;
  subText?: string;
  className?: string;
}

export const ChecklistItem: React.FC<ChecklistItemProps> = ({
  label,
  status,
  subText,
  className = '',
}) => {
  const getIconAndStyle = () => {
    switch (status) {
      case 'completed':
        return {
          icon: <Check size={14} strokeWidth={2.5} />,
          color: '#34D399',
          bg: 'rgba(52, 211, 153, 0.15)',
        };
      case 'partial':
        return {
          icon: <CircleDot size={14} strokeWidth={2.2} />,
          color: '#FBBF24',
          bg: 'rgba(251, 191, 36, 0.15)',
        };
      case 'warning':
        return {
          icon: <AlertTriangle size={13} strokeWidth={2} />,
          color: '#FBBF24',
          bg: 'rgba(251, 191, 36, 0.15)',
        };
      case 'pending':
      default:
        // CRITICAL INVARIANT: Slate dashed circle, NEVER red (BRAIN §3)
        return {
          icon: <Circle size={13} strokeWidth={1.8} style={{ strokeDasharray: '2 2' }} />,
          color: '#94A3B8',
          bg: 'rgba(148, 163, 184, 0.08)',
        };
    }
  };

  const { icon, color, bg } = getIconAndStyle();

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '6px 0',
      }}
    >
      <div
        style={{
          width: '22px',
          height: '22px',
          borderRadius: '6px',
          backgroundColor: bg,
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: '13px',
            color: 'var(--text, #E8EEF9)',
            fontWeight: 500,
          }}
        >
          {label}
        </span>
        {subText && (
          <span
            style={{
              fontSize: '11px',
              color: 'var(--muted, #8C9AB8)',
              marginLeft: '8px',
            }}
          >
            {subText}
          </span>
        )}
      </div>
    </div>
  );
};
