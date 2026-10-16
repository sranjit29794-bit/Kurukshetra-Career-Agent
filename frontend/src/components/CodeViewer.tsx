import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { GitCommit, ExternalLink, FileCode, Check } from 'lucide-react';

interface CodeViewerProps {
  filePath: string;
  sha: string;
  code: string;
  language?: string;
  highlightRange?: { start: number; end: number } | null;
  repoOwner?: string;
  repoName?: string;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({
  filePath,
  sha,
  code,
  language = 'python',
  highlightRange = null,
  repoOwner = 'rohan-student',
  repoName = 'student-api',
}) => {
  const shortSha = sha.substring(0, 7);
  const githubUrl = highlightRange
    ? `https://github.com/${repoOwner}/${repoName}/blob/${sha}/${filePath}#L${highlightRange.start}-L${highlightRange.end}`
    : `https://github.com/${repoOwner}/${repoName}/blob/${sha}/${filePath}`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}
    >
      {/* Top Breadcrumb & Metadata Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--surface-2)',
          fontSize: '12px',
        }}
      >
        {/* Breadcrumb Path */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <FileCode size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ color: 'var(--muted)' }}>{repoName}</span>
          <span style={{ color: 'var(--border)' }}>/</span>
          <span style={{ fontWeight: 600, color: 'var(--text)', fontFamily: 'JetBrains Mono' }}>
            {filePath}
          </span>
          {highlightRange && (
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '4px',
                backgroundColor: 'rgba(45, 212, 191, 0.15)',
                color: 'var(--accent)',
                fontWeight: 600,
              }}
            >
              L{highlightRange.start}–L{highlightRange.end}
            </span>
          )}
        </div>

        {/* SHA Badge & Permalinks */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <span
            title={`Pinned at commit ${sha}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: 'JetBrains Mono',
              fontSize: '11.5px',
              color: 'var(--accent)',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              padding: '2px 8px',
              borderRadius: '4px',
            }}
          >
            <GitCommit size={12} />
            {shortSha}
          </span>

          <a
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              color: 'var(--muted)',
              textDecoration: 'none',
              fontSize: '11.5px',
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid transparent',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--muted)';
              e.currentTarget.style.borderColor = 'transparent';
            }}
          >
            <span>View on GitHub</span>
            <ExternalLink size={11} />
          </a>
        </div>
      </div>

      {/* Code Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'auto',
          backgroundColor: '#0B0F14',
          fontSize: '12.5px',
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          showLineNumbers
          wrapLines
          customStyle={{
            margin: 0,
            padding: '16px 0',
            backgroundColor: '#0B0F14',
            fontSize: '12px',
            lineHeight: 1.6,
          }}
          lineNumberStyle={{
            minWidth: '40px',
            paddingRight: '16px',
            color: '#4B5563',
            textAlign: 'right',
            userSelect: 'none',
          }}
          lineProps={(lineNumber: number) => {
            const isHighlighted =
              highlightRange !== null &&
              lineNumber >= highlightRange.start &&
              lineNumber <= highlightRange.end;

            return {
              style: {
                display: 'block',
                backgroundColor: isHighlighted ? 'rgba(45, 212, 191, 0.14)' : 'transparent',
                borderLeft: isHighlighted ? '3px solid var(--accent)' : '3px solid transparent',
                paddingLeft: '12px',
                paddingRight: '12px',
                transition: 'background-color 0.2s ease',
              },
            };
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>

      {/* Footer Info */}
      <div
        style={{
          padding: '6px 16px',
          backgroundColor: 'var(--surface-2)',
          borderTop: '1px solid var(--border)',
          fontSize: '11px',
          color: 'var(--muted)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Check size={12} style={{ color: 'var(--status-demonstrated)' }} />
          Verified line citation at commit SHA
        </span>
        <span>UTF-8 • LF • {language.toUpperCase()}</span>
      </div>
    </div>
  );
};
