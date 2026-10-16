import React from 'react';

export interface LiveChipProps {
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const LiveChip: React.FC<LiveChipProps> = ({
  label = 'Live',
  size = 'md',
  className = '',
}) => {
  const padding = size === 'sm' ? '1px 6px' : '2px 8px';
  const fontSize = size === 'sm' ? '10px' : '11px';

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding,
        fontSize,
        fontWeight: 600,
        borderRadius: 'var(--radius-pill, 8px)',
        backgroundColor: 'rgba(52, 211, 153, 0.12)',
        color: '#34D399',
        border: '1px solid rgba(52, 211, 153, 0.28)',
        whiteSpace: 'nowrap',
        letterSpacing: '0.02em',
      }}
    >
      <span
        className="pulse-dot"
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: '#34D399',
          display: 'inline-block',
        }}
      />
      <span>{label}</span>
    </span>
  );
};
