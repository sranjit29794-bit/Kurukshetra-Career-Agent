import React from 'react';
import { Info } from 'lucide-react';

export interface InfoBannerProps {
  message?: string;
  className?: string;
}

export const InfoBanner: React.FC<InfoBannerProps> = ({
  message = "Not demonstrated means not found in the analyzed scope — it doesn't prove you lack the skill.",
  className = '',
}) => {
  return (
    <div
      className={className}
      style={{
        backgroundColor: 'rgba(47, 109, 246, 0.06)',
        borderBottom: '1px solid rgba(47, 109, 246, 0.18)',
        padding: '7px 24px',
        fontSize: '12px',
        color: '#8C9AB8',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        lineHeight: 1.4,
      }}
    >
      <Info size={13} style={{ color: '#2F6DF6', flexShrink: 0 }} />
      <span>
        <strong style={{ color: '#E8EEF9', fontWeight: 600 }}>Absence ≠ Failure:</strong>{' '}
        {message}
      </span>
    </div>
  );
};
