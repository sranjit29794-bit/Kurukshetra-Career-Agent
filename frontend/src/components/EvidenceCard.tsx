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
import { StatusPill } from './StatusPill';
import { StrengthLabel } from './StrengthLabel';
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

  // UNABLE TO ASSESS STATE (Failure != Gap per Invariant #8)
  if (assessment.status === 'UNABLE_TO_ASSESS') {
    return (
      <div
        className="reference-card"
        style={{
          padding: '24px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderColor: 'rgba(167, 139, 250, 0.4)',
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text, #E8EEF9)' }}>
              {requirement ? requirement.name : assessment.requirement_id}
            </h2>
            <StatusPill status="UNABLE_TO_ASSESS" size="md" />
          </div>

          <div
            style={{
              backgroundColor: 'rgba(167, 139, 250, 0.08)',
              border: '1px solid rgba(167, 139, 250, 0.25)',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#A78BFA', marginBottom: '8px', fontWeight: 600 }}>
              <AlertTriangle size={18} />
              <span>Assessment Inconclusive / Analysis Error</span>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text, #E8EEF9)', lineHeight: 1.5 }}>
              {assessment.summary ||
                'Static analysis encountered an unhandled syntax structure, or third-party retrieval failed. Under DevProof Invariant #8, analysis failure is displayed as Unable to assess rather than penalizing the student as a skill gap.'}
            </p>
          </div>

          {assessment.limitation && (
            <div style={{ fontSize: '12.5px', color: 'var(--muted, #8C9AB8)', marginBottom: '14px' }}>
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
              backgroundColor: 'var(--surface-2, #101A30)',
              border: '1px solid var(--border, #1A2748)',
              color: 'var(--text, #E8EEF9)',
              padding: '8px 16px',
              borderRadius: '8px',
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

  // NORMAL EVIDENCE CARD
  return (
    <div
      className="reference-card"
      style={{
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
          borderBottom: '1px solid var(--border, #1A2748)',
          paddingBottom: '16px',
          marginBottom: '18px',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text, #E8EEF9)' }}>
              {requirement ? requirement.name : assessment.requirement_id}
            </h2>
            {requirement && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor:
                    requirement.priority === 'must'
                      ? 'rgba(47, 109, 246, 0.15)'
                      : 'var(--surface-2, #101A30)',
                  color: requirement.priority === 'must' ? '#60A5FA' : 'var(--muted, #8C9AB8)',
                  border: '1px solid var(--border, #1A2748)',
                }}
              >
                {requirement.priority.toUpperCase()}
              </span>
            )}
          </div>

          {requirement?.source_sentence && (
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted, #8C9AB8)', fontStyle: 'italic' }}>
              &ldquo;{requirement.source_sentence}&rdquo;
            </p>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <StatusPill status={assessment.status} size="md" />
          <StrengthLabel strength={assessment.strength} size="sm" />
        </div>
      </div>

      {/* Evidence Summary */}
      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted, #8C9AB8)', margin: '0 0 6px 0', fontWeight: 600 }}>
          Evidence Summary
        </h4>
        <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text, #E8EEF9)', lineHeight: 1.55 }}>
          {assessment.summary}
        </p>
      </div>

      {/* Verified Evidence Links */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h4 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted, #8C9AB8)', margin: 0, fontWeight: 600 }}>
            Verified Line Citations ({assessment.evidence.length})
          </h4>
          <span style={{ fontSize: '11px', color: 'var(--primary, #2F6DF6)' }}>Click to view code in right pane</span>
        </div>

        {assessment.evidence.length === 0 ? (
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: 'var(--surface-2, #101A30)',
              borderRadius: '8px',
              fontSize: '12.5px',
              color: 'var(--muted, #8C9AB8)',
              border: '1px dashed var(--border, #1A2748)',
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
                    borderRadius: '8px',
                    backgroundColor: isSelected ? 'rgba(47, 109, 246, 0.12)' : 'var(--surface-2, #101A30)',
                    border: `1px solid ${isSelected ? 'var(--primary, #2F6DF6)' : 'var(--border, #1A2748)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Code2 size={15} style={{ color: isSelected ? 'var(--primary, #2F6DF6)' : 'var(--muted, #8C9AB8)' }} />
                    <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text, #E8EEF9)', fontFamily: 'JetBrains Mono' }}>
                      {ev.file_path}
                    </span>
                    <span
                      style={{
                        fontSize: '11.5px',
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(47, 109, 246, 0.15)',
                        color: '#60A5FA',
                      }}
                    >
                      L{ev.line_start}–L{ev.line_end}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--muted, #8C9AB8)',
                        backgroundColor: 'var(--surface, #0A1228)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: '1px solid var(--border, #1A2748)',
                      }}
                    >
                      {ev.detector}
                    </span>
                    <ExternalLink size={12} style={{ color: isSelected ? 'var(--primary, #2F6DF6)' : 'var(--muted, #8C9AB8)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ignored Signals Section */}
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
              backgroundColor: 'var(--surface-2, #101A30)',
              border: '1px solid var(--border, #1A2748)',
              borderRadius: '8px',
              color: 'var(--muted, #8C9AB8)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldAlert size={14} style={{ color: '#FBBF24' }} />
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
                borderRadius: '8px',
                fontSize: '12px',
                color: 'var(--text, #E8EEF9)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              {assessment.ignored_signals.map((sig, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <span style={{ color: '#FBBF24' }}>•</span>
                  <span>
                    {sig.reason} {sig.file_path && <code>({sig.file_path}:{sig.line})</code>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Limitation Box (Amber-tinted) */}
      {assessment.limitation && (
        <div
          style={{
            backgroundColor: 'rgba(251, 191, 36, 0.08)',
            border: '1px solid rgba(251, 191, 36, 0.25)',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#FBBF24', fontWeight: 600, fontSize: '12.5px', marginBottom: '4px' }}>
            <AlertTriangle size={14} />
            <span>Limitation / Verified Scope Boundary</span>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text, #E8EEF9)', lineHeight: 1.45 }}>
            {assessment.limitation}
          </p>
        </div>
      )}

      {/* Recommended Next Step Box (Teal/Blue Box) */}
      {assessment.next_step && (
        <div
          style={{
            backgroundColor: 'rgba(47, 109, 246, 0.08)',
            border: '1px solid rgba(47, 109, 246, 0.25)',
            borderRadius: '10px',
            padding: '12px 14px',
            marginTop: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary, #2F6DF6)', fontWeight: 600, fontSize: '12.5px', marginBottom: '4px' }}>
            <Sparkles size={14} />
            <span>Recommended Next Step (Actionable Code Improvement)</span>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text, #E8EEF9)', lineHeight: 1.45 }}>
            {assessment.next_step}
          </p>
        </div>
      )}
    </div>
  );
};
