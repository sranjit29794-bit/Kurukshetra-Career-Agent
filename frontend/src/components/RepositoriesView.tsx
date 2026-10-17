import React, { useState } from 'react';
import {
  GitBranch,
  RefreshCw,
} from 'lucide-react';
import { ChecklistItem } from './ChecklistItem';

export interface RepositoriesViewProps {
  repoOwner?: string;
  repoName?: string;
  branch?: string;
  lastSha?: string;
  onRunAssessment?: () => void;
}

export const RepositoriesView: React.FC<RepositoriesViewProps> = ({
  repoOwner = 'rohan-dev',
  repoName = 'portfolio',
  branch = 'main',
  lastSha = 'a1b2c3d4e5f67890123456789abcdef012345678',
  onRunAssessment,
}) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [progressStep, setProgressStep] = useState(3); // 1 to 4

  const handleStartAnalysis = async () => {
    setAnalyzing(true);
    setProgressStep(4);
    if (onRunAssessment) {
      await onRunAssessment();
    }
    setAnalyzing(false);
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '36px 28px' }}>
      {/* Title */}
      <div style={{ marginBottom: '28px' }}>
        <h1
          style={{
            fontSize: '22px',
            fontWeight: 800,
            letterSpacing: '-0.025em',
            margin: '0 0 6px 0',
            color: 'var(--text, #E8EEF9)',
          }}
        >
          Repository Analysis
        </h1>
        <p style={{ margin: 0, color: 'var(--muted, #8C9AB8)', fontSize: '13.5px' }}>
          Connect your GitHub repository and select the commit to analyze.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: '24px' }}>
        {/* Left: Connected Repository Card */}
        <div className="reference-card" style={{ padding: '24px' }}>
          {/* GitHub Repository Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              paddingBottom: '16px',
              borderBottom: '1px solid var(--border, #1A2748)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--surface-2, #101A30)',
                  border: '1px solid var(--border, #1A2748)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#CBD5E1',
                }}
              >
                <GitBranch size={20} />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--muted, #8C9AB8)', fontWeight: 500 }}>
                  GitHub Repository
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text, #E8EEF9)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{repoOwner}/{repoName}</span>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(148, 163, 184, 0.1)',
                      color: 'var(--muted, #8C9AB8)',
                      border: '1px solid var(--border, #1A2748)',
                      fontWeight: 500,
                    }}
                  >
                    Public
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted, #8C9AB8)', marginTop: '2px' }}>
                  branch: <code style={{ color: 'var(--primary, #2F6DF6)' }}>{branch}</code>
                </div>
              </div>
            </div>

            <button
              style={{
                backgroundColor: 'var(--surface-2, #101A30)',
                border: '1px solid var(--border, #1A2748)',
                color: 'var(--text, #E8EEF9)',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Change
            </button>
          </div>

          {/* Commit SHA selection */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text, #E8EEF9)',
                marginBottom: '8px',
              }}
            >
              Commit SHA
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--surface-2, #101A30)',
                border: '1px solid var(--border, #1A2748)',
                borderRadius: '8px',
                padding: '8px 12px',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: '13px', color: 'var(--text, #E8EEF9)' }}>
                {lastSha.slice(0, 16)}...
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(52, 211, 153, 0.12)',
                  color: '#34D399',
                  border: '1px solid rgba(52, 211, 153, 0.3)',
                }}
              >
                Latest
              </span>
            </div>
          </div>

          {/* Start Analysis CTA */}
          <button
            onClick={handleStartAnalysis}
            disabled={analyzing}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: 'var(--primary, #2F6DF6)',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: '14px',
              borderRadius: '8px',
              border: 'none',
              cursor: analyzing ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 2px 10px rgba(47, 109, 246, 0.4)',
              transition: 'background-color 0.15s ease',
            }}
          >
            {analyzing ? (
              <>
                <RefreshCw size={16} className="pulse-dot" />
                <span>Running Static Analysis...</span>
              </>
            ) : (
              <span>Start Analysis</span>
            )}
          </button>
        </div>

        {/* Right: Analyzing Repository Progress card */}
        <div className="reference-card" style={{ padding: '24px' }}>
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 700,
              margin: '0 0 16px 0',
              color: 'var(--text, #E8EEF9)',
            }}
          >
            Analyzing Repository
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <ChecklistItem
              label="Fetching repository data"
              status={progressStep >= 1 ? 'completed' : 'pending'}
            />
            <ChecklistItem
              label="Scanning files and code"
              status={progressStep >= 2 ? 'completed' : progressStep === 1 ? 'partial' : 'pending'}
            />
            <ChecklistItem
              label="Matching skills with requirements"
              status={progressStep >= 3 ? 'completed' : progressStep === 2 ? 'partial' : 'pending'}
            />
            <ChecklistItem
              label="Generating evidence citations"
              status={progressStep >= 4 ? 'completed' : progressStep === 3 ? 'partial' : 'pending'}
            />
          </div>

          <div
            style={{
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border, #1A2748)',
              fontSize: '12px',
              color: 'var(--muted, #8C9AB8)',
            }}
          >
            {analyzing ? 'This may take a few seconds...' : 'Static AST analysis ready.'}
          </div>
        </div>
      </div>
    </div>
  );
};
