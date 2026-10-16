import React from 'react';
import { ArrowLeft, ArrowRight, FileText, GitBranch } from 'lucide-react';
import type { ClaimsMatrixData } from '../types';
import { StatusPill } from './StatusPill';
import { InfoBanner } from './InfoBanner';
import claimsFixture from '../../../docs/fixtures/claims_matrix.json';

interface ClaimsMatrixViewProps {
  jobId?: string;
  data?: ClaimsMatrixData;
  onBackToDashboard: () => void;
  onProceedToAssessment: (trackId: string) => void;
}

export const ClaimsMatrixView: React.FC<ClaimsMatrixViewProps> = ({
  jobId,
  data,
  onBackToDashboard,
  onProceedToAssessment,
}) => {
  // Use provided data or fallback to canonical fixture
  const matrix: ClaimsMatrixData = data || (claimsFixture as unknown as ClaimsMatrixData);
  const primaryRepo = matrix.repos[0];

  return (
    <div
      style={{
        padding: '32px',
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
    >
      {/* Top Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          type="button"
          onClick={onBackToDashboard}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            color: 'var(--muted, #8C9AB8)',
            fontSize: '13.5px',
            fontWeight: 500,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>

        {primaryRepo && (
          <button
            type="button"
            onClick={() => onProceedToAssessment(primaryRepo.track_id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--primary, #2F6DF6)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 18px',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(47, 109, 246, 0.3)',
            }}
          >
            <span>Proceed to Full Assessment</span>
            <ArrowRight size={15} />
          </button>
        )}
      </div>

      {/* Title & Scope Badges */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: 'var(--text, #E8EEF9)' }}>
            Claims Matrix (Pre-Analysis)
          </h1>
          <span
            style={{
              backgroundColor: 'rgba(47, 109, 246, 0.15)',
              color: '#60A5FA',
              fontSize: '11.5px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '6px',
              border: '1px solid rgba(47, 109, 246, 0.3)',
            }}
          >
            {jobId || matrix.job_id}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted, #8C9AB8)' }}>
          Comparing skills claimed on the resume (E0) against preliminary static implementation signals found in selected repositories.
        </p>
      </div>

      {/* Persistent Honesty Banner */}
      <InfoBanner
        message="Missing evidence means not demonstrated in the analyzed repository scope — it does not prove the candidate lacks the skill."
      />

      {/* Selected Repositories Chips */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '14px 18px',
          backgroundColor: 'var(--surface-1, #0A1224)',
          border: '1px solid var(--border, #1A2748)',
          borderRadius: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--muted, #8C9AB8)' }}>
          <GitBranch size={16} color="var(--primary, #2F6DF6)" />
          <span style={{ fontWeight: 600, color: 'var(--text, #E8EEF9)' }}>Analyzed Scope:</span>
        </div>
        {matrix.repos.map((repo) => (
          <div
            key={repo.track_id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--surface-2, #101A30)',
              border: '1px solid var(--border, #1A2748)',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '12.5px',
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--text, #E8EEF9)' }}>{repo.full_name}</span>
            <span style={{ color: 'var(--muted, #8C9AB8)', fontFamily: 'monospace' }}>
              @{repo.sha.slice(0, 7)}
            </span>
          </div>
        ))}
      </div>

      {/* Claims Matrix Table */}
      <div
        style={{
          backgroundColor: 'var(--surface-1, #0A1224)',
          border: '1px solid var(--border, #1A2748)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr
              style={{
                borderBottom: '1px solid var(--border, #1A2748)',
                backgroundColor: 'var(--surface-2, #101A30)',
              }}
            >
              <th
                style={{
                  padding: '14px 20px',
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: 'var(--muted, #8C9AB8)',
                  textTransform: 'uppercase',
                }}
              >
                Requirement
              </th>
              <th
                style={{
                  padding: '14px 20px',
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: 'var(--muted, #8C9AB8)',
                  textTransform: 'uppercase',
                  width: '200px',
                }}
              >
                Claimed in Resume
              </th>
              {matrix.repos.map((repo) => (
                <th
                  key={repo.track_id}
                  style={{
                    padding: '14px 20px',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    color: 'var(--muted, #8C9AB8)',
                    textTransform: 'uppercase',
                  }}
                >
                  {repo.full_name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row, idx) => {
              const isEven = idx % 2 === 0;
              return (
                <tr
                  key={row.requirement_id}
                  style={{
                    backgroundColor: isEven ? 'transparent' : 'rgba(16, 26, 48, 0.4)',
                    borderBottom: '1px solid var(--border, #1A2748)',
                  }}
                >
                  {/* Requirement Name */}
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text, #E8EEF9)' }}>
                      {row.name}
                    </div>
                  </td>

                  {/* Claimed in Resume */}
                  <td style={{ padding: '16px 20px' }}>
                    {row.claimed ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                          border: '1px solid rgba(59, 130, 246, 0.25)',
                          borderRadius: '6px',
                          padding: '3px 8px',
                          fontSize: '12px',
                          color: '#60A5FA',
                        }}
                      >
                        <FileText size={12} />
                        <span>E0 Claimed</span>
                        {row.claim_source_line && (
                          <span style={{ opacity: 0.7, fontSize: '11px' }}>
                            (L{row.claim_source_line})
                          </span>
                        )}
                      </span>
                    ) : (
                      <span style={{ fontSize: '12.5px', color: 'var(--muted, #8C9AB8)' }}>
                        Unclaimed
                      </span>
                    )}
                  </td>

                  {/* Repository Cells */}
                  {row.cells.map((cell) => (
                    <td key={cell.track_id} style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <StatusPill status={cell.status} size="sm" />
                        {cell.strength && cell.strength !== 'none' && (
                          <span
                            style={{
                              fontSize: '11px',
                              color: 'var(--muted, #8C9AB8)',
                              textTransform: 'capitalize',
                            }}
                          >
                            ({cell.strength})
                          </span>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
