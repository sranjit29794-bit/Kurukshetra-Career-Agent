import React, { useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  X,
  GitCommit,
  ExternalLink,
  FileCode,
  CheckCircle2,
  Copy,
  Check,
} from 'lucide-react';
import { REPO_CODE_FIXTURES } from '../fixtures/repoCode';

interface CodeViewerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string;
  sha: string;
  highlightRange?: { start: number; end: number } | null;
  repoOwner?: string;
  repoName?: string;
}

export const CodeViewerDrawer: React.FC<CodeViewerDrawerProps> = ({
  isOpen,
  onClose,
  filePath,
  sha,
  highlightRange = null,
  repoOwner = 'rohan-student',
  repoName = 'student-api',
}) => {
  const [copied, setCopied] = React.useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scrolling when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const fileData = REPO_CODE_FIXTURES[filePath] || {
    path: filePath,
    sha,
    language: filePath.endsWith('.py') ? 'python' : filePath.endsWith('.md') ? 'markdown' : 'json',
    content: `# File: ${filePath}\n# Pinned at commit ${sha.substring(0, 7)}\n# No local fixture file available for this path.`,
  };

  const shortSha = sha ? sha.substring(0, 7) : 'c3d4e5f';
  const githubUrl = highlightRange
    ? `https://github.com/${repoOwner}/${repoName}/blob/${sha}/${filePath}#L${highlightRange.start}-L${highlightRange.end}`
    : `https://github.com/${repoOwner}/${repoName}/blob/${sha}/${filePath}`;

  const handleCopyPermalink = () => {
    navigator.clipboard.writeText(githubUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(5, 10, 26, 0.75)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          transition: 'opacity 0.25s ease',
          animation: 'fadeIn 0.2s ease-out',
        }}
      />

      {/* Drawer Panel */}
      <div
        style={{
          position: 'relative',
          width: 'min(780px, 92vw)',
          height: '100%',
          backgroundColor: 'var(--surface, #0A1228)',
          borderLeft: '1px solid var(--border, #1A2748)',
          boxShadow: '-10px 0 35px rgba(0, 0, 0, 0.7), 0 0 1px rgba(26, 39, 72, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10000,
          animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            backgroundColor: 'var(--surface-2, #101A30)',
            borderBottom: '1px solid var(--border, #1A2748)',
            gap: '12px',
          }}
        >
          {/* Breadcrumb Path & Line Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: 'rgba(47, 109, 246, 0.12)',
                border: '1px solid rgba(47, 109, 246, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <FileCode size={15} style={{ color: 'var(--primary, #2F6DF6)' }} />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                minWidth: 0,
              }}
            >
              <span style={{ color: 'var(--muted, #8C9AB8)' }}>{repoName}</span>
              <span style={{ color: 'var(--border, #1A2748)' }}>/</span>
              <span
                style={{
                  fontWeight: 600,
                  color: 'var(--text, #E8EEF9)',
                  fontFamily: 'JetBrains Mono, monospace',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {filePath}
              </span>
            </div>

            {highlightRange && (
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'JetBrains Mono, monospace',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(52, 211, 153, 0.12)',
                  color: '#34D399',
                  border: '1px solid rgba(52, 211, 153, 0.25)',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                L{highlightRange.start}–L{highlightRange.end}
              </span>
            )}
          </div>

          {/* Right Header Actions: SHA Badge + GitHub Permalink + Close */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {/* Analyzed Commit SHA Badge */}
            <span
              title={`Pinned at analyzed SHA ${sha}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '11.5px',
                color: 'var(--primary, #2F6DF6)',
                backgroundColor: 'rgba(47, 109, 246, 0.08)',
                border: '1px solid rgba(47, 109, 246, 0.25)',
                padding: '3px 8px',
                borderRadius: '6px',
              }}
            >
              <GitCommit size={12} />
              {shortSha}
            </span>

            {/* View on GitHub Button */}
            <a
              href={githubUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                color: 'var(--text, #E8EEF9)',
                backgroundColor: 'var(--surface, #0A1228)',
                border: '1px solid var(--border, #1A2748)',
                textDecoration: 'none',
                fontSize: '12px',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '6px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary, #2F6DF6)';
                e.currentTarget.style.color = '#FFFFFF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border, #1A2748)';
                e.currentTarget.style.color = 'var(--text, #E8EEF9)';
              }}
            >
              <span>View on GitHub</span>
              <ExternalLink size={12} />
            </a>

            {/* Copy Permalink */}
            <button
              onClick={handleCopyPermalink}
              title="Copy GitHub Permalink"
              style={{
                background: 'none',
                border: '1px solid var(--border, #1A2748)',
                borderRadius: '6px',
                padding: '4px 8px',
                color: copied ? '#34D399' : 'var(--muted, #8C9AB8)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>

            {/* Close Drawer Button */}
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: '1px solid var(--border, #1A2748)',
                borderRadius: '6px',
                padding: '4px 8px',
                color: 'var(--muted, #8C9AB8)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                e.currentTarget.style.color = '#EF4444';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = 'var(--border, #1A2748)';
                e.currentTarget.style.color = 'var(--muted, #8C9AB8)';
              }}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Code Content Container */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'auto',
            backgroundColor: '#070C18',
            fontSize: '12.5px',
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          <SyntaxHighlighter
            language={fileData.language}
            style={vscDarkPlus}
            showLineNumbers
            wrapLines
            customStyle={{
              margin: 0,
              padding: '16px 0',
              backgroundColor: '#070C18',
              fontSize: '12px',
              lineHeight: 1.6,
            }}
            lineNumberStyle={{
              minWidth: '44px',
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
                  backgroundColor: isHighlighted ? 'rgba(47, 109, 246, 0.15)' : 'transparent',
                  borderLeft: isHighlighted ? '3px solid #2F6DF6' : '3px solid transparent',
                  paddingLeft: '14px',
                  paddingRight: '14px',
                  transition: 'background-color 0.2s ease',
                },
              };
            }}
          >
            {fileData.content}
          </SyntaxHighlighter>
        </div>

        {/* Footer Verification Bar */}
        <div
          style={{
            padding: '10px 20px',
            backgroundColor: 'var(--surface-2, #101A30)',
            borderTop: '1px solid var(--border, #1A2748)',
            fontSize: '12px',
            color: 'var(--muted, #8C9AB8)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={14} style={{ color: '#34D399' }} />
            <span style={{ color: 'var(--text, #E8EEF9)', fontWeight: 500 }}>
              Verified line citation at analyzed commit SHA {shortSha}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>UTF-8 • LF • {fileData.language.toUpperCase()}</span>
            <span style={{ color: 'var(--border, #1A2748)' }}>•</span>
            <span style={{ fontSize: '11px' }}>Press <kbd style={{ padding: '1px 5px', borderRadius: '3px', background: 'var(--surface, #0A1228)', border: '1px solid var(--border, #1A2748)' }}>Esc</kbd> to close</span>
          </div>
        </div>
      </div>
    </div>
  );
};
