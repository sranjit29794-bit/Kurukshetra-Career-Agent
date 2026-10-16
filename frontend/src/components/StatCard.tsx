import React from 'react';

export interface StatCardProps {
  icon: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  label: string;
  value: string;
  subLine?: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  icon,
  iconBg = 'linear-gradient(135deg, rgba(47, 109, 246, 0.25) 0%, rgba(30, 58, 138, 0.4) 100%)',
  iconColor = '#60A5FA',
  label,
  value,
  subLine,
  actionText,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`reference-card ${className}`}
      onClick={onAction}
      style={{
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '136px',
        cursor: onAction ? 'pointer' : 'default',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
        {/* Rounded square icon tile */}
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: iconBg,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: iconColor,
            flexShrink: 0,
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
          }}
        >
          {icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--muted, #8C9AB8)',
              marginBottom: '4px',
              textTransform: 'none',
              letterSpacing: '0.01em',
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: '17px',
              fontWeight: 700,
              color: 'var(--text, #E8EEF9)',
              letterSpacing: '-0.02em',
              lineHeight: 1.25,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {value}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '16px',
          paddingTop: '8px',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            color: 'var(--muted, #8C9AB8)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {subLine}
        </span>

        {actionText && (
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--primary, #2F6DF6)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              flexShrink: 0,
              marginLeft: '8px',
            }}
          >
            {actionText}
          </span>
        )}
      </div>
    </div>
  );
};
