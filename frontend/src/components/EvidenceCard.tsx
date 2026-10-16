import React, { useState } from 'react';
import {
  Code2,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import type { VerifiedAssessment, Requirement, Evidence } from '../types';

interface EvidenceCardProps {
  assessment: VerifiedAssessment;
  requirement?: Requirement;
  onSelectCitation: (evidence: Evidence) => void;
  selectedEvidenceId?: string;
  onRetry?: () => void;
}

export const EvidenceCard: React.FC<EvidenceCardProps> = ({
  assessment,
  requirement,
  onSelectCitation,
  selectedEvidenceId,
  onRetry,
}) => {
  const [showIgnoredSignals, setShowIgnoredSignals] = useState<boolean>(false);

  // Strength label formatting per BRAIN §10.4
  const getStrengthLabel = (strength: string) => {
    switch (strength) {
      case 'strong':
        return { label: 'Strong Evidence', color: 'var(--status-demonstrated)', bg: 'rgba(52, 211, 153, 0.12)' };
      case 'moderate':
        return { label: 'Moderate Evidence', color: 'var(--status-partial)', bg: 'rgba(251, 191, 36, 0.12)' };
      case 'limited':
        return { label: 'Limited Evidence', color: 'var(--muted)', bg: 'var(--surface-2)' };
      case 'none':
      default:
        return { label: 'No Verified Evidence', color: 'var(--muted)', bg: 'var(--surface-2)' };
    }
  };

  const strengthBadge = getStrengthLabel(assessment.strength);

  // ==========================================================================
  // UNABLE TO ASSESS STATE (Failure != Gap per Invariant #8)
  // ==========================================================================
  if (assessment.status === 'UNABLE_TO_ASSESS') {
    return (
      <div
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid rgba(167, 139, 250, 0.4)',
          borderRadius: 'var(--radius)',
          padding: '24px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text)' }}>
                {requirement ? requirement.name : assessment.requirement_id}
              </h2>
              {requirement && (
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  Category: {requirement.category}
                </span>
              )}
            </div>
            <StatusBadge status="UNABLE_TO_ASSESS" size="md" />
          </div>

          <div
            style={{
              backgroundColor: 'rgba(167, 139, 250, 0.08)',
              border: '1px solid rgba(167, 139, 250, 0.25)',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--status-unable)', marginBottom: '8px', fontWeight: 600 }}>
              <AlertTriangle size={18} />
              <span>Assessment Inconclusive / Analysis Error</span>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text)', lineHeight: 1.5 }}>
              {assessment.summary ||
                'Static analysis encountered an unhandled syntax structure, or third-party retrieval failed. Under DevProof Invariant #8, analysis failure is displayed as Unable to assess rather than penalizing the student as a skill gap.'}
            </p>
          </div>

          {assessment.limitation && (
            <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: '14px' }}>
              <strong>Details:</strong> {assessment.limitation}
            </div>
          )}
        </div>

        <div>
          <button
            onClick={onRetry}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} /> Retry Analysis
          </button>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // NORMAL EVIDENCE CARD
  // ==========================================================================
  return (
    <div
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
      }}
    >
      {/* Header: Skill Name, Status Pill & Strength Label */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '16px',
          marginBottom: '18px',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
              {requirement ? requirement.name : assessment.requirement_id}
            </h2>
            {requirement && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor:
                    requirement.priority === 'must'
                      ? 'rgba(45, 212, 191, 0.15)'
                      : 'var(--surface-2)',
                  color: requirement.priority === 'must' ? 'var(--accent)' : 'var(--muted)',
                }}
              >
                {requirement.priority.toUpperCase()}
              </span>
            )}
          </div>

          {requirement?.source_sentence && (
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic' }}>
              &ldquo;{requirement.source_sentence}&rdquo;
            </p>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <StatusBadge status={assessment.status} size="md" />
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: strengthBadge.bg,
              color: strengthBadge.color,
            }}
          >
            {strengthBadge.label}
          </span>
        </div>
      </div>

      {/* Evidence Summary */}
      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted)', margin: '0 0 6px 0' }}>
          Evidence Summary
        </h4>
        <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text)', lineHeight: 1.55 }}>
          {assessment.summary}
        </p>
      </div>

      {/* Verified Evidence Links */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h4 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted)', margin: 0 }}>
            Verified Line Citations ({assessment.evidence.length})
          </h4>
          <span style={{ fontSize: '11px', color: 'var(--accent)' }}>Click to view code in right pane</span>
        </div>

        {assessment.evidence.length === 0 ? (
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: 'var(--surface-2)',
              borderRadius: '6px',
              fontSize: '12.5px',
              color: 'var(--muted)',
              border: '1px dashed var(--border)',
            }}
          >
            No verified evidence found in analyzed repository files.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {assessment.evidence.map((ev) => {
              const isSelected = selectedEvidenceId === ev.id;
              return (
                <div
                  key={ev.id}
                  onClick={() => onSelectCitation(ev)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    backgroundColor: isSelected ? 'rgba(45, 212, 191, 0.1)' : 'var(--surface-2)',
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Code2 size={15} style={{ color: isSelected ? 'var(--accent)' : 'var(--muted)' }} />
                    <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)', fontFamily: 'JetBrains Mono' }}>
                      {ev.file_path}
                    </span>
                    <span
                      style={{
                        fontSize: '11.5px',
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--surface)',
                        color: 'var(--accent)',
                      }}
                    >
                      L{ev.line_start}–L{ev.line_end}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--muted)',
                        backgroundColor: 'var(--surface)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {ev.detector}
                    </span>
                    <ExternalLink size={12} style={{ color: isSelected ? 'var(--accent)' : 'var(--muted)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ignored Signals Section (Weak Signal Immunity per BRAIN §3, §10) */}
      {assessment.ignored_signals && assessment.ignored_signals.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={() => setShowIgnoredSignals((prev) => !prev)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              backgroundColor: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--muted)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldAlert size={14} style={{ color: 'var(--status-partial)' }} />
              Ignored Signals ({assessment.ignored_signals.length}) — Weak-signal immunity
            </span>
            {showIgnoredSignals ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showIgnoredSignals && (
            <div
              style={{
                marginTop: '6px',
                padding: '10px 14px',
                backgroundColor: 'rgba(251, 191, 36, 0.04)',
                border: '1px solid rgba(251, 191, 36, 0.2)',
                borderRadius: '6px',
                fontSize: '12px',
                color: 'var(--text)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              {assessment.ignored_signals.map((sig, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <span style={{ color: 'var(--status-partial)' }}>•</span>
                  <span>
                    {sig.reason} {sig.file_path && <code>({sig.file_path}:{sig.line})</code>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Limitation Box (Amber-tinted per BRAIN §16.3) */}
      {assessment.limitation && (
        <div
          style={{
            backgroundColor: 'rgba(251, 191, 36, 0.08)',
            border: '1px solid rgba(251, 191, 36, 0.25)',
            borderRadius: '8px',
            padding: '12px 14px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--status-partial)', fontWeight: 600, fontSize: '12.5px', marginBottom: '4px' }}>
            <AlertTriangle size={14} />
            <span>Limitation / Verified Scope Boundary</span>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text)', lineHeight: 1.45 }}>
            {assessment.limitation}
          </p>
        </div>
      )}

      {/* Recommended Next Step Box (Teal Box, visually separate from verified facts per BRAIN §16.3) */}
      {assessment.next_step && (
        <div
          style={{
            backgroundColor: 'rgba(45, 212, 191, 0.08)',
            border: '1px solid rgba(45, 212, 191, 0.3)',
            borderRadius: '8px',
            padding: '12px 14px',
            marginTop: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent)', fontWeight: 600, fontSize: '12.5px', marginBottom: '4px' }}>
            <Sparkles size={14} />
            <span>Recommended Next Step (Actionable Code Improvement)</span>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text)', lineHeight: 1.45 }}>
            {assessment.next_step}
          </p>
        </div>
      )}
    </div>
  );
};
