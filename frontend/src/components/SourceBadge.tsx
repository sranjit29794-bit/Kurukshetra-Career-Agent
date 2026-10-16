import React from 'react';
import { Globe, FileText, ExternalLink } from 'lucide-react';

export interface SourceBadgeProps {
  sourceType: 'fetched' | 'user_provided' | 'manual';
  sourceUrl?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const SourceBadge: React.FC<SourceBadgeProps> = ({
  sourceType,
  sourceUrl,
  size = 'md',
  className = '',
}) => {
  const iconSize = size === 'sm' ? 12 : 13;
  const padding = size === 'sm' ? '2px 8px' : '3px 10px';
  const fontSize = size === 'sm' ? '11px' : '12px';

  if (sourceType === 'fetched') {
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
          backgroundColor: 'rgba(47, 109, 246, 0.12)',
          color: '#60A5FA',
          border: '1px solid rgba(47, 109, 246, 0.28)',
          whiteSpace: 'nowrap',
        }}
      >
        <Globe size={iconSize} />
        <span>Fetched from job board</span>
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ color: 'inherit', display: 'inline-flex', alignItems: 'center' }}
            title={`Open ${sourceUrl}`}
          >
            <ExternalLink size={10} />
          </a>
        )}
      </span>
    );
  }

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
        backgroundColor: 'rgba(148, 163, 184, 0.1)',
        color: '#94A3B8',
        border: '1px solid rgba(148, 163, 184, 0.25)',
        whiteSpace: 'nowrap',
      }}
    >
      <FileText size={iconSize} />
      <span>User-provided description</span>
    </span>
  );
};
