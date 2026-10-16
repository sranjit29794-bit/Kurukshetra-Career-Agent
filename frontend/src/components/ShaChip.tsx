import React, { useState } from 'react';
import { GitCommit, Copy, Check } from 'lucide-react';

export interface ShaChipProps {
  sha: string;
  branch?: string;
  copyable?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export const ShaChip: React.FC<ShaChipProps> = ({
  sha,
  branch,
  copyable = true,
  size = 'md',
  className = '',
}) => {
  const [copied, setCopied] = useState(false);
  const shortSha = sha ? sha.slice(0, 7) : 'head';
  const iconSize = size === 'sm' ? 12 : 13;
  const padding = size === 'sm' ? '2px 8px' : '3px 10px';
  const fontSize = size === 'sm' ? '11px' : '12px';

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(sha);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <span
      className={className}
      onClick={copyable ? handleCopy : undefined}
      title={copyable ? `Copy commit SHA: ${sha}` : sha}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding,
        fontSize,
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 500,
        borderRadius: 'var(--radius-pill, 8px)',
        backgroundColor: 'var(--surface-2, #101A30)',
        color: 'var(--text, #E8EEF9)',
        border: '1px solid var(--border, #1A2748)',
        cursor: copyable ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
        transition: 'border-color 0.15s ease',
      }}
    >
      <GitCommit size={iconSize} style={{ color: 'var(--primary, #2F6DF6)' }} />
      {branch && <span style={{ color: 'var(--muted, #8C9AB8)' }}>{branch}@</span>}
      <span>{shortSha}</span>
      {copyable && (
        <span style={{ color: copied ? '#34D399' : 'var(--muted, #8C9AB8)', marginLeft: '2px' }}>
          {copied ? <Check size={11} /> : <Copy size={11} />}
        </span>
      )}
    </span>
  );
};
